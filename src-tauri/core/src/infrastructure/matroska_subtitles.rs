use crate::domain::subtitles::{
    decode_subtitle_bytes, format_vtt_time, strip_ass_tags, SubtitleExtractor, SubtitleTrackInfo,
};
use matroska_demuxer::{
    ContentCompAlgo, ContentEncoding, ContentEncodingValue, MatroskaFile, TrackType,
};
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;
use tokio::runtime::Handle;

pub struct SyncReader<S> {
    stream: S,
    handle: Handle,
}

impl<S> SyncReader<S> {
    pub fn new(stream: S) -> Self {
        Self {
            stream,
            handle: Handle::current(),
        }
    }
}

impl<S: tokio::io::AsyncRead + Unpin> Read for SyncReader<S> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.handle.block_on(async {
            use tokio::io::AsyncReadExt;
            self.stream.read(buf).await
        })
    }
}

impl<S: tokio::io::AsyncSeek + Unpin> Seek for SyncReader<S> {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        self.handle.block_on(async {
            use tokio::io::AsyncSeekExt;
            self.stream.seek(pos).await
        })
    }
}

pub struct ZeroCheckReader<R> {
    inner: R,
    consecutive_zeros: usize,
    skip_check: bool,
}

impl<R> ZeroCheckReader<R> {
    pub fn new(inner: R) -> Self {
        Self {
            inner,
            consecutive_zeros: 0,
            skip_check: false,
        }
    }

    pub fn new_skip_check(inner: R) -> Self {
        Self {
            inner,
            consecutive_zeros: 0,
            skip_check: true,
        }
    }
}

impl<R: Read> Read for ZeroCheckReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        if self.skip_check {
            return self.inner.read(buf);
        }

        let n = self.inner.read(buf)?;
        if n == 0 {
            return Ok(0);
        }

        for &byte in &buf[..n] {
            if byte == 0 {
                self.consecutive_zeros += 1;
                // If we see more than 8192 consecutive zeros, assume we hit the unwritten/undownloaded sparse area
                if self.consecutive_zeros > 8192 {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        "Incomplete file: detected too many consecutive zero bytes in sparse allocation",
                    ));
                }
            } else {
                self.consecutive_zeros = 0;
            }
        }

        Ok(n)
    }
}

impl<R: Seek> Seek for ZeroCheckReader<R> {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        if self.skip_check {
            return self.inner.seek(pos);
        }
        // When seeking, reset consecutive zeros because we jumped to a new position
        self.consecutive_zeros = 0;
        self.inner.seek(pos)
    }
}

pub fn extract_subtitle_tracks_from_reader<R: Read + Seek>(
    reader: R,
    skip_check: bool,
) -> Result<Vec<SubtitleTrackInfo>, String> {
    let checked_reader = if skip_check {
        ZeroCheckReader::new_skip_check(reader)
    } else {
        ZeroCheckReader::new(reader)
    };
    let mkv =
        MatroskaFile::open(checked_reader).map_err(|e| format!("Failed to parse MKV: {:?}", e))?;

    let mut tracks = Vec::new();
    for track in mkv.tracks() {
        if track.track_type() == TrackType::Subtitle {
            let codec = track.codec_id().to_string();
            if codec == "S_TEXT/UTF8" || codec == "S_TEXT/ASS" || codec == "S_TEXT/SSA" {
                let language = track.language().unwrap_or("und").to_string();
                let title = track.name().unwrap_or("").to_string();
                tracks.push(SubtitleTrackInfo {
                    id: track.track_number().get(),
                    language,
                    title,
                    codec,
                });
            }
        }
    }
    Ok(tracks)
}

fn decompress_by_algo(
    algo: ContentCompAlgo,
    settings: Option<&[u8]>,
    data: &[u8],
) -> Result<Vec<u8>, String> {
    match algo {
        ContentCompAlgo::Zlib => {
            let mut decoder = flate2::read::ZlibDecoder::new(data);
            let mut buf = Vec::new();
            decoder
                .read_to_end(&mut buf)
                .map_err(|e| format!("Failed to inflate compressed subtitle frame: {}", e))?;
            Ok(buf)
        }
        ContentCompAlgo::Stripping => {
            let settings = settings.unwrap_or(&[]);
            let mut buf = Vec::with_capacity(settings.len() + data.len());
            buf.extend_from_slice(settings);
            buf.extend_from_slice(data);
            Ok(buf)
        }
        algo => Err(format!(
            "Unsupported subtitle content compression algorithm: {:?}",
            algo
        )),
    }
}

fn decompress_frame_data(encodings: &[ContentEncoding], data: &[u8]) -> Result<Vec<u8>, String> {
    let mut result = data.to_vec();
    for encoding in encodings {
        match encoding.encoding() {
            ContentEncodingValue::Compression(compression) => {
                result = decompress_by_algo(compression.algo(), compression.settings(), &result)?
            }
            ContentEncodingValue::Encryption(_) => {
                return Err("Encrypted subtitle tracks are not supported".to_string());
            }
            ContentEncodingValue::Unknown => {
                return Err("Unknown subtitle content encoding".to_string());
            }
        }
    }
    Ok(result)
}

pub fn extract_subtitle_vtt_from_reader<R: Read + Seek>(
    reader: R,
    track_id: u64,
    skip_check: bool,
) -> Result<String, String> {
    let checked_reader = if skip_check {
        ZeroCheckReader::new_skip_check(reader)
    } else {
        ZeroCheckReader::new(reader)
    };
    let mut mkv =
        MatroskaFile::open(checked_reader).map_err(|e| format!("Failed to parse MKV: {:?}", e))?;

    let track = mkv
        .tracks()
        .iter()
        .find(|t| t.track_number().get() == track_id)
        .ok_or_else(|| "Subtitle track not found".to_string())?;

    let codec = track.codec_id().to_string();
    if codec != "S_TEXT/UTF8" && codec != "S_TEXT/ASS" && codec != "S_TEXT/SSA" {
        return Err(format!("Unsupported subtitle codec: {}", codec));
    }

    let encodings: Vec<ContentEncoding> = track
        .content_encodings()
        .map(|encodings| encodings.to_vec())
        .unwrap_or_default();

    let mut frame = matroska_demuxer::Frame::default();
    let mut cues = Vec::new();

    while let Ok(true) = mkv.next_frame(&mut frame) {
        if frame.track == track_id {
            let start_ms = frame.timestamp;
            let duration_ms = frame.duration.unwrap_or(3000);
            let end_ms = start_ms + duration_ms;

            let frame_data = decompress_frame_data(&encodings, &frame.data)?;

            let raw_text = if codec == "S_TEXT/ASS" || codec == "S_TEXT/SSA" {
                let s = decode_subtitle_bytes(&frame_data);
                let parts: Vec<&str> = s.splitn(9, ',').collect();
                if parts.len() == 9 {
                    parts[8].to_string()
                } else {
                    s
                }
            } else {
                decode_subtitle_bytes(&frame_data)
            };

            let clean_text = strip_ass_tags(&raw_text);
            cues.push((start_ms, end_ms, clean_text));
        }
    }

    cues.sort_by_key(|c| c.0);

    let mut vtt = String::from("WEBVTT\n\n");
    for (i, (start, end, text)) in cues.into_iter().enumerate() {
        vtt.push_str(&format!("{}\n", i + 1));
        vtt.push_str(&format!(
            "{} --> {}\n",
            format_vtt_time(start),
            format_vtt_time(end)
        ));
        vtt.push_str(&format!("{}\n\n", text.trim()));
    }

    Ok(vtt)
}

pub fn extract_subtitle_tracks(path: &Path) -> Result<Vec<SubtitleTrackInfo>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);
    extract_subtitle_tracks_from_reader(reader, true)
}

pub fn extract_subtitle_vtt(path: &Path, track_id: u64) -> Result<String, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);
    extract_subtitle_vtt_from_reader(reader, track_id, true)
}

pub struct MatroskaSubtitleExtractor;

impl SubtitleExtractor for MatroskaSubtitleExtractor {
    fn extract_subtitle_tracks(&self, path: &Path) -> Result<Vec<SubtitleTrackInfo>, String> {
        extract_subtitle_tracks(path)
    }

    fn extract_subtitle_vtt(&self, path: &Path, track_id: u64) -> Result<String, String> {
        extract_subtitle_vtt(path, track_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    #[allow(non_snake_case)]
    fn 测试_提取非存在文件的字幕轨道_应返回错误() {
        let extractor = MatroskaSubtitleExtractor;
        let path = Path::new("non_existent_file.mkv");
        let result = extractor.extract_subtitle_tracks(path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open file"));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_提取非存在文件的字幕VTT_应返回错误() {
        let extractor = MatroskaSubtitleExtractor;
        let path = Path::new("non_existent_file.mkv");
        let result = extractor.extract_subtitle_vtt(path, 1);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open file"));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_提取无效格式文件的字幕_应返回解析错误() {
        let extractor = MatroskaSubtitleExtractor;
        let temp_path = std::env::temp_dir().join("invalid_mkv_test_matroska.mkv");
        std::fs::write(&temp_path, b"invalid mkv data").unwrap();

        let result_tracks = extractor.extract_subtitle_tracks(&temp_path);
        assert!(result_tracks.is_err());
        assert!(result_tracks.unwrap_err().contains("Failed to parse MKV"));

        let result_vtt = extractor.extract_subtitle_vtt(&temp_path, 1);
        assert!(result_vtt.is_err());
        assert!(result_vtt.unwrap_err().contains("Failed to parse MKV"));

        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_读取大量连续零字节_应返回错误() {
        let zeros = vec![0u8; 10000];
        let cursor = std::io::Cursor::new(zeros);
        let mut reader = ZeroCheckReader::new(cursor);
        let mut buf = vec![0u8; 10000];
        let result = reader.read(&mut buf);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().kind(), std::io::ErrorKind::InvalidData);
    }

    #[test]
    fn 测试_zlib压缩的字幕帧_应解压还原() {
        let plain = b"Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello";
        let mut encoder =
            flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(plain).unwrap();
        let compressed = encoder.finish().unwrap();

        let result = decompress_by_algo(ContentCompAlgo::Zlib, None, &compressed).unwrap();
        assert_eq!(result, plain);
    }

    #[test]
    fn 测试_header_stripping字幕帧_应还原被剥离的头部() {
        let stripped_header = b"Dialogue: 0,";
        let frame_without_header = b"0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello";

        let result = decompress_by_algo(
            ContentCompAlgo::Stripping,
            Some(stripped_header),
            frame_without_header,
        )
        .unwrap();
        assert_eq!(
            result,
            b"Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello"
        );
    }

    #[test]
    fn 测试_未压缩字幕帧_应原样返回() {
        let data = b"Plain subtitle frame";
        let result = decompress_frame_data(&[], data).unwrap();
        assert_eq!(result, data);
    }
}
