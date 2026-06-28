use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SubtitleTrackInfo {
    pub id: u64,
    pub language: String,
    pub title: String,
    pub codec: String,
}

pub trait SubtitleExtractor: Send + Sync {
    fn extract_subtitle_tracks(&self, path: &Path) -> Result<Vec<SubtitleTrackInfo>, String>;
    fn extract_subtitle_vtt(&self, path: &Path, track_id: u64) -> Result<String, String>;
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
}
