use crate::domain::subtitles::{
    decode_subtitle_bytes, format_vtt_time, strip_ass_tags, AudioTrackInfo, ChapterInfo,
    SubtitleExtractor, SubtitleTrackInfo, VideoInfo, VideoTrackInfo,
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

struct SubtitleCue {
    start_ms: u64,
    end_ms: u64,
    text: String,
}

fn split_ass_frame_cues(frames: &[(u64, u64, String)]) -> Vec<SubtitleCue> {
    frames
        .iter()
        .filter(|(_, _, raw)| !is_drawing_frame(raw))
        .map(|(start_ms, end_ms, raw)| {
            let text = strip_ass_tags(ass_text_field(raw)).trim().to_string();
            SubtitleCue {
                start_ms: *start_ms,
                end_ms: *end_ms,
                text,
            }
        })
        .filter(|cue| !cue.text.is_empty())
        .collect()
}

/// 切分出 ASS 帧行的文本字段。
///
/// 标准 ASS 事件 = 10 个字段：`Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text`，
/// 文本前有 9 个字段分隔逗号；本项目的 MKV 帧被剥离了 `Dialogue: ` 前缀，只有 9 个字段，
/// 文本前有 8 个逗号。override 块 `{...}` 内可能含逗号（如 `\fad(0,200)`、`\pos(1041,862)`），
/// 这些逗号不能被当作字段分隔符。
fn ass_text_field(raw: &str) -> &str {
    let starts_with_type =
        raw.trim_start().starts_with("Dialogue:") || raw.trim_start().starts_with("Comment:");
    let field_sep_count = if starts_with_type { 9 } else { 8 };

    let mut brace_depth = 0u32;
    let mut top_level_commas = 0u32;
    let mut split_at = None;
    for (i, c) in raw.char_indices() {
        match c {
            '{' => brace_depth += 1,
            '}' => brace_depth = brace_depth.saturating_sub(1),
            ',' if brace_depth == 0 => {
                top_level_commas += 1;
                if top_level_commas == field_sep_count {
                    split_at = Some(i);
                }
            }
            _ => {}
        }
    }
    match split_at {
        Some(i) => &raw[i + 1..],
        None => raw,
    }
}

/// 判断该帧是否为纯矢量绘图（ASS `\p1`..`\p4` 绘制模式），
/// 这类帧转成 VTT 文本只会输出 `m 50 0 l ...` 之类的绘图指令，应整体丢弃。
fn is_drawing_frame(raw: &str) -> bool {
    raw.contains("\\p1") || raw.contains("\\p2") || raw.contains("\\p3") || raw.contains("\\p4")
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
    let is_ass = codec == "S_TEXT/ASS" || codec == "S_TEXT/SSA";

    let mut frames: Vec<(u64, u64, String)> = Vec::new();
    let mut frame = matroska_demuxer::Frame::default();
    while let Ok(true) = mkv.next_frame(&mut frame) {
        if frame.track != track_id {
            continue;
        }
        let start_ms = frame.timestamp;
        let duration_ms = frame.duration.unwrap_or(3000);
        let end_ms = start_ms + duration_ms;
        let frame_data = decompress_frame_data(&encodings, &frame.data)?;
        frames.push((start_ms, end_ms, decode_subtitle_bytes(&frame_data)));
    }
    log::info!("字幕提取: track_id={} 收集到 {} 帧", track_id, frames.len());

    let cues = if is_ass {
        let cues = split_ass_frame_cues(&frames);
        log::info!("ASS 帧拆分解析完成，共 {} 条", cues.len());
        cues
    } else {
        frames
            .iter()
            .map(|(start_ms, end_ms, text)| SubtitleCue {
                start_ms: *start_ms,
                end_ms: *end_ms,
                text: text.trim().to_string(),
            })
            .filter(|cue| !cue.text.is_empty())
            .collect()
    };

    let mut sorted = cues;
    sorted.sort_by_key(|c| c.start_ms);
    if sorted.is_empty() {
        log::warn!(
            "字幕提取结果为空: track_id={} codec={} 帧数={}",
            track_id,
            codec,
            frames.len()
        );
    }

    let mut vtt = String::from("WEBVTT\n\n");
    for (i, (start, end, text)) in sorted
        .into_iter()
        .map(|c| (c.start_ms, c.end_ms, c.text))
        .enumerate()
    {
        vtt.push_str(&format!("{}\n", i + 1));
        vtt.push_str(&format!(
            "{} --> {}\n",
            format_vtt_time(start),
            format_vtt_time(end)
        ));
        vtt.push_str(&format!("{}\n\n", text));
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

pub fn extract_video_chapters_from_reader<R: Read + Seek>(
    reader: R,
    skip_check: bool,
) -> Result<Vec<ChapterInfo>, String> {
    let checked_reader = if skip_check {
        ZeroCheckReader::new_skip_check(reader)
    } else {
        ZeroCheckReader::new(reader)
    };
    let mkv =
        MatroskaFile::open(checked_reader).map_err(|e| format!("Failed to parse MKV: {:?}", e))?;

    let mut chapters = Vec::new();
    let Some(editions) = mkv.chapters() else {
        return Ok(chapters);
    };
    for edition in editions {
        for atom in edition.chapter_atoms() {
            let start_ms = atom.time_start() / 1_000_000;
            let end_ms = atom.time_end().map(|ns| ns / 1_000_000);
            // 优先选择语言为中文/日文的显示名，否则取第一个
            let display = atom
                .displays()
                .iter()
                .find(|d| {
                    matches!(
                        d.language(),
                        Some("chi") | Some("zho") | Some("jpn") | Some("ja")
                    )
                })
                .or_else(|| atom.displays().first());
            let (title, language) = match display {
                Some(d) => (d.string().to_string(), d.language().map(|s| s.to_string())),
                None => (String::new(), None),
            };
            if !title.is_empty() {
                chapters.push(ChapterInfo {
                    start_ms,
                    end_ms,
                    title,
                    language,
                });
            }
        }
    }
    Ok(chapters)
}

pub fn extract_video_chapters(path: &Path) -> Result<Vec<ChapterInfo>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);
    extract_video_chapters_from_reader(reader, true)
}

const fn date_utc_ns_to_unix_secs(ns_since_2001: i64) -> i64 {
    // Matroska DateUTC 以自 2001-01-01T00:00:00 UTC 起算的纳秒数存储。
    const NANOS_PER_SEC: i64 = 1_000_000_000;
    // 2001-01-01T00:00:00Z 与 Unix 纪元(1970-01-01)之间的秒数。
    const UNIX_SECS_AT_2001: i64 = 978_307_200;
    ns_since_2001 / NANOS_PER_SEC + UNIX_SECS_AT_2001
}

const fn duration_ns_to_ms(ns: Option<f64>) -> Option<u64> {
    let Some(ns) = ns else {
        return None;
    };
    if ns <= 0.0 {
        return Some(0);
    }
    Some(ns as u64 / 1_000_000)
}

pub fn extract_video_info_from_reader<R: Read + Seek>(
    reader: R,
    skip_check: bool,
) -> Result<VideoInfo, String> {
    let checked_reader = if skip_check {
        ZeroCheckReader::new_skip_check(reader)
    } else {
        ZeroCheckReader::new(reader)
    };
    let mkv =
        MatroskaFile::open(checked_reader).map_err(|e| format!("Failed to parse MKV: {:?}", e))?;

    let info = mkv.info();
    let mut video_tracks = Vec::new();
    let mut audio_tracks = Vec::new();
    for track in mkv.tracks() {
        let track_id = track.track_number().get();
        let codec = track.codec_id().to_string();
        let language = track.language().map(|s| s.to_string());
        let default = track.flag_default();
        let forced = track.flag_forced();
        match track.track_type() {
            TrackType::Video => {
                if let Some(video) = track.video() {
                    video_tracks.push(VideoTrackInfo {
                        track_id,
                        codec,
                        width: video.pixel_width().get() as u32,
                        height: video.pixel_height().get() as u32,
                        language,
                        default,
                        forced,
                    });
                }
            }
            TrackType::Audio => {
                if let Some(audio) = track.audio() {
                    audio_tracks.push(AudioTrackInfo {
                        track_id,
                        codec,
                        channels: audio.channels().get(),
                        sampling_rate: audio.sampling_frequency().round().max(0.0) as u64,
                        language,
                        default,
                    });
                }
            }
            _ => {}
        }
    }

    Ok(VideoInfo {
        duration_ms: duration_ns_to_ms(info.duration()),
        title: info.title().map(|s| s.to_string()),
        date_utc: info.date_utc().map(date_utc_ns_to_unix_secs),
        muxing_app: info.muxing_app().to_string(),
        writing_app: info.writing_app().to_string(),
        video_tracks,
        audio_tracks,
    })
}

pub fn extract_video_info(path: &Path) -> Result<VideoInfo, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);
    extract_video_info_from_reader(reader, true)
}

pub struct MatroskaSubtitleExtractor;

impl SubtitleExtractor for MatroskaSubtitleExtractor {
    fn extract_subtitle_tracks(&self, path: &Path) -> Result<Vec<SubtitleTrackInfo>, String> {
        extract_subtitle_tracks(path)
    }

    fn extract_subtitle_vtt(&self, path: &Path, track_id: u64) -> Result<String, String> {
        extract_subtitle_vtt(path, track_id)
    }

    fn extract_video_chapters(&self, path: &Path) -> Result<Vec<ChapterInfo>, String> {
        extract_video_chapters(path)
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

    #[test]
    #[allow(non_snake_case)]
    fn 测试_帧拆分_标准ASS对话行_取文本并清理标签() {
        let frames = vec![(
            1000u64,
            3000u64,
            "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\pos(10,10)}Hello".to_string(),
        )];
        let cues = split_ass_frame_cues(&frames);
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].start_ms, 1000);
        assert_eq!(cues[0].end_ms, 3000);
        assert_eq!(cues[0].text, "Hello");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_帧拆分_文本含逗号时完整保留() {
        let frames = vec![(
            1000u64,
            3000u64,
            "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello, world, again".to_string(),
        )];
        let cues = split_ass_frame_cues(&frames);
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].text, "Hello, world, again");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_帧拆分_非标准帧_未分到文本字段时保留原文() {
        let frames = vec![(1000u64, 3000u64, "Plain frame text".to_string())];
        let cues = split_ass_frame_cues(&frames);
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].text, "Plain frame text");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_帧拆分_九字段无前缀帧_取最后字段并按帧时间() {
        let frames = vec![(
            1600u64,
            4000u64,
            "1,0,Default,,0,0,0,,我的名字是花织米蒂娅".to_string(),
        )];
        let cues = split_ass_frame_cues(&frames);
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].start_ms, 1600);
        assert_eq!(cues[0].end_ms, 4000);
        assert_eq!(cues[0].text, "我的名字是花织米蒂娅");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_帧拆分_空文本帧应被过滤() {
        let frames = vec![
            (1000u64, 3000u64, "1,0,Default,,0,0,0,,".to_string()),
            (4000u64, 6000u64, "  ".to_string()),
        ];
        let cues = split_ass_frame_cues(&frames);
        assert!(cues.is_empty());
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_帧拆分_override块内逗号_不切断文本() {
        let frames = vec![(
            1000u64,
            3000u64,
            "1,0,Default,,0,0,0,,{\\fad(0,200)\\pos(960,30)}本字幕由{\\c&HFF110F&}喵萌奶茶屋制作"
                .to_string(),
        )];
        let cues = split_ass_frame_cues(&frames);
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].text, "本字幕由喵萌奶茶屋制作");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_帧拆分_纯矢量绘图帧_应丢弃() {
        let frames = vec![(
            1000u64,
            3000u64,
            "1,0,Default,,0,0,0,,{\\fscx43.87\\fscy43.87\\an7\\p1\\pos(714.8,813.2)}m 50 0 l 63.6 28 50 50 m 100 50 l 72 63 50 50{\\p0}".to_string(),
        )];
        let cues = split_ass_frame_cues(&frames);
        assert!(cues.is_empty());
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_帧拆分_标准Dialogue行_override块内逗号_不切断文本() {
        let frames = vec![(
            1000u64,
            3000u64,
            "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\fad(0,200)\\pos(960,30)}Hello"
                .to_string(),
        )];
        let cues = split_ass_frame_cues(&frames);
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].text, "Hello");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_提取非存在文件的章节_应返回错误() {
        let extractor = MatroskaSubtitleExtractor;
        let path = Path::new("non_existent_file.mkv");
        let result = extractor.extract_video_chapters(path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open file"));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_提取无效格式文件的章节_应返回解析错误() {
        let temp_path = std::env::temp_dir().join("invalid_mkv_test_chapters.mkv");
        std::fs::write(&temp_path, b"invalid mkv data").unwrap();

        let result = extract_video_chapters(&temp_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to parse MKV"));

        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    fn 测试_读取不含章节元素的合法MKV_应返回空章节列表() {
        let mkv = build_test_mkv(false);
        let result = extract_video_chapters_from_reader(std::io::Cursor::new(mkv), true);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Vec::<ChapterInfo>::new());
    }

    #[test]
    fn 测试_读取含章节元素的合法MKV_应解析出章节时间与标题() {
        let mkv = build_test_mkv(true);
        let result = extract_video_chapters_from_reader(std::io::Cursor::new(mkv), true);
        assert!(result.is_ok());
        let chapters = result.unwrap();
        assert_eq!(chapters.len(), 1);
        assert_eq!(chapters[0].start_ms, 0);
        assert_eq!(chapters[0].end_ms, Some(1000));
        assert_eq!(chapters[0].title, "Opening");
        assert_eq!(chapters[0].language.as_deref(), Some("eng"));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_提取非存在文件的媒体信息_应返回错误() {
        let path = Path::new("non_existent_file.mkv");
        let result = extract_video_info(path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open file"));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_提取无效格式文件的媒体信息_应返回解析错误() {
        let temp_path = std::env::temp_dir().join("invalid_mkv_test_info.mkv");
        std::fs::write(&temp_path, b"invalid mkv data").unwrap();

        let result = extract_video_info(&temp_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to parse MKV"));

        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    fn 测试_读取合法MKV_应解析出视频轨道与封装信息() {
        let mkv = build_test_mkv(false);
        let result = extract_video_info_from_reader(std::io::Cursor::new(mkv), true);
        assert!(result.is_ok());
        let info = result.unwrap();

        assert_eq!(info.duration_ms, None);
        assert_eq!(info.title, None);
        assert_eq!(info.date_utc, None);
        assert_eq!(info.muxing_app, "test");
        assert_eq!(info.writing_app, "test");

        assert_eq!(info.video_tracks.len(), 1);
        assert_eq!(info.video_tracks[0].track_id, 1);
        assert_eq!(info.video_tracks[0].codec, "V_MPEG4/ISO/AVC");
        assert_eq!(info.video_tracks[0].width, 1);
        assert_eq!(info.video_tracks[0].height, 1);

        assert!(info.audio_tracks.is_empty());
    }

    #[test]
    fn 测试_date_utc纳秒转Unix秒() {
        // 2001-01-01T00:00:00Z 本身
        assert_eq!(date_utc_ns_to_unix_secs(0), 978_307_200);
        // 2001-01-01T00:00:01Z
        assert_eq!(date_utc_ns_to_unix_secs(1_000_000_000), 978_307_201);
    }

    #[test]
    fn 测试_时长纳秒转毫秒() {
        assert_eq!(duration_ns_to_ms(None), None);
        assert_eq!(duration_ns_to_ms(Some(0.0)), Some(0));
        assert_eq!(duration_ns_to_ms(Some(1_000_000.0)), Some(1));
        assert_eq!(duration_ns_to_ms(Some(6_001_000_000.0)), Some(6001));
        assert_eq!(duration_ns_to_ms(Some(-5.0)), Some(0));
    }

    // EBML 编码辅助函数与最小合法 MKV 构造器
    fn ebml_master(id: &[u8], payload: &[u8]) -> Vec<u8> {
        let mut out = id.to_vec();
        let len = payload.len();
        if len < 0x80 {
            out.push(0x80 | len as u8);
        } else if len < 0x4000 {
            out.push(0x40 | (len >> 8) as u8);
            out.push(len as u8);
        } else if len < 0x200000 {
            out.push(0x20 | (len >> 16) as u8);
            out.push((len >> 8) as u8);
            out.push(len as u8);
        }
        out.extend_from_slice(payload);
        out
    }

    fn ebml_uint(id: &[u8], value: u64) -> Vec<u8> {
        let bytes = value.to_be_bytes();
        let start = bytes.iter().position(|&b| b != 0).unwrap_or(7);
        let mut out = id.to_vec();
        out.push(0x80 | (8 - start) as u8);
        out.extend_from_slice(&bytes[start..]);
        out
    }

    fn ebml_str(id: &[u8], s: &str) -> Vec<u8> {
        let mut out = id.to_vec();
        out.push(0x80 | s.len() as u8);
        out.extend_from_slice(s.as_bytes());
        out
    }

    fn build_test_mkv(with_chapters: bool) -> Vec<u8> {
        let ebml = ebml_master(
            &[0x1A, 0x45, 0xDF, 0xA3],
            &[
                ebml_uint(&[0x42, 0x86], 1),
                ebml_uint(&[0x42, 0xF7], 1),
                ebml_str(&[0x42, 0x82], "matroska"),
                ebml_uint(&[0x42, 0x87], 4),
                ebml_uint(&[0x42, 0x85], 2),
            ]
            .concat(),
        );

        let info = ebml_master(
            &[0x15, 0x49, 0xA9, 0x66],
            &[
                ebml_uint(&[0x2A, 0xD7, 0xB1], 1_000_000),
                ebml_str(&[0x4D, 0x80], "test"),
                ebml_str(&[0x57, 0x41], "test"),
            ]
            .concat(),
        );

        let video = ebml_master(
            &[0xE0],
            &[ebml_uint(&[0xB0], 1), ebml_uint(&[0xBA], 1)].concat(),
        );
        let track_entry = ebml_master(
            &[0xAE],
            &[
                ebml_uint(&[0xD7], 1),
                ebml_uint(&[0x73, 0xC5], 1),
                ebml_uint(&[0x83], 1),
                ebml_str(&[0x86], "V_MPEG4/ISO/AVC"),
                video,
            ]
            .concat(),
        );
        let tracks = ebml_master(&[0x16, 0x54, 0xAE, 0x6B], &track_entry);

        let cluster = vec![0x1F, 0x43, 0xB6, 0x75, 0x80];

        let mut segment_payload = vec![info, tracks, cluster].concat();
        if with_chapters {
            let chapter_display = ebml_master(
                &[0x80],
                &[ebml_str(&[0x85], "Opening"), ebml_str(&[0x43, 0x7C], "eng")].concat(),
            );
            let chapter_atom = ebml_master(
                &[0xB6],
                &[
                    ebml_uint(&[0x73, 0xC4], 1),
                    ebml_uint(&[0x91], 0),
                    ebml_uint(&[0x92], 1_000_000_000),
                    chapter_display,
                ]
                .concat(),
            );
            let edition = ebml_master(&[0x45, 0xB9], &chapter_atom);
            segment_payload.extend(ebml_master(&[0x10, 0x43, 0xA7, 0x70], &edition));
        }

        let segment = ebml_master(&[0x18, 0x53, 0x80, 0x67], &segment_payload);
        [ebml, segment].concat()
    }
}
