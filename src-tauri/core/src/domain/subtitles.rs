use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SubtitleTrackInfo {
    pub id: u64,
    pub language: String,
    pub title: String,
    pub codec: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ChapterInfo {
    pub start_ms: u64,
    pub end_ms: Option<u64>,
    pub title: String,
    pub language: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct VideoInfo {
    pub duration_ms: Option<u64>,
    pub title: Option<String>,
    /// Unix 时间戳（秒）。源数据为纳秒级自 2001-01-01 起算。
    pub date_utc: Option<i64>,
    pub muxing_app: String,
    pub writing_app: String,
    pub video_tracks: Vec<VideoTrackInfo>,
    pub audio_tracks: Vec<AudioTrackInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct VideoTrackInfo {
    pub track_id: u64,
    pub codec: String,
    pub width: u32,
    pub height: u32,
    pub language: Option<String>,
    pub default: bool,
    pub forced: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AudioTrackInfo {
    pub track_id: u64,
    pub codec: String,
    pub channels: u64,
    pub sampling_rate: u64,
    pub language: Option<String>,
    pub default: bool,
}

pub trait SubtitleExtractor: Send + Sync {
    fn extract_subtitle_tracks(&self, path: &Path) -> Result<Vec<SubtitleTrackInfo>, String>;
    fn extract_subtitle_vtt(&self, path: &Path, track_id: u64) -> Result<String, String>;
    fn extract_video_chapters(&self, path: &Path) -> Result<Vec<ChapterInfo>, String>;
}

pub fn strip_ass_tags(text: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    for c in text.chars() {
        if c == '{' {
            in_tag = true;
        } else if c == '}' {
            in_tag = false;
        } else if !in_tag {
            result.push(c);
        }
    }
    result.replace("\\N", "\n").replace("\\n", "\n")
}

pub fn decode_subtitle_bytes(bytes: &[u8]) -> String {
    if let Some((encoding, _)) = encoding_rs::Encoding::for_bom(bytes) {
        let (decoded, _, _) = encoding.decode(bytes);
        return decoded.into_owned();
    }

    if let Ok(text) = std::str::from_utf8(bytes) {
        return text.to_string();
    }

    let mut detector = chardetng::EncodingDetector::new(chardetng::Iso2022JpDetection::Deny);
    detector.feed(bytes, true);
    let encoding = detector.guess(None, chardetng::Utf8Detection::Deny);
    let (decoded, _) = encoding.decode_without_bom_handling(bytes);
    if decoded.contains('\u{FFFD}') {
        String::from_utf8_lossy(bytes).into_owned()
    } else {
        decoded.into_owned()
    }
}

pub fn format_vtt_time(ms: u64) -> String {
    let hours = ms / 3_600_000;
    let minutes = (ms % 3_600_000) / 60_000;
    let seconds = (ms % 60_000) / 1_000;
    let millis = ms % 1_000;
    format!("{:02}:{:02}:{:02}.{:03}", hours, minutes, seconds, millis)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ass_tags() {
        let input = "{\\pos(192,200)}Hello {\\fnArial\\fs20}World!";
        assert_eq!(strip_ass_tags(input), "Hello World!");

        let input_br = "Line 1\\NLine 2\\nLine 3";
        assert_eq!(strip_ass_tags(input_br), "Line 1\nLine 2\nLine 3");
    }

    #[test]
    fn test_format_vtt_time() {
        assert_eq!(format_vtt_time(0), "00:00:00.000");
        assert_eq!(format_vtt_time(123), "00:00:00.123");
        assert_eq!(format_vtt_time(61000), "00:01:01.000");
        assert_eq!(format_vtt_time(3661000), "01:01:01.000");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_解码GBK编码的字节_应还原为中文() {
        let gbk_zhong_wen = [0xD6, 0xD0, 0xCE, 0xC4];
        assert_eq!(decode_subtitle_bytes(&gbk_zhong_wen), "中文");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_解码UTF16LE带BOM的字节_应还原为中文() {
        let utf16le_bom = [0xFF, 0xFE, 0x2D, 0x4E, 0x87, 0x65];
        assert_eq!(decode_subtitle_bytes(&utf16le_bom), "中文");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_解码UTF8字节_应原样返回() {
        let utf8_zhong_wen = "中文".as_bytes();
        assert_eq!(decode_subtitle_bytes(utf8_zhong_wen), "中文");
    }

    #[test]
    fn 测试_解码非法字节序列_应使用替换字符兜底而不panic() {
        let invalid = [0xFF, 0xFE, 0x00, 0x80, 0x81];
        let result = decode_subtitle_bytes(&invalid);
        assert!(result.contains('\u{FFFD}'));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_解码ShiftJIS编码的字节_应还原为日文() {
        let sjis_konnichiwa = [0x82, 0xB1, 0x82, 0xF1, 0x82, 0xC9, 0x82, 0xBF, 0x82, 0xCD];
        assert_eq!(decode_subtitle_bytes(&sjis_konnichiwa), "こんにちは");
    }
}
