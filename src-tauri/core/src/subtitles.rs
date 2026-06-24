use matroska_demuxer::{MatroskaFile, TrackType};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SubtitleTrackInfo {
    pub id: u64,
    pub language: String,
    pub title: String,
    pub codec: String,
}

fn strip_ass_tags(text: &str) -> String {
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

fn format_vtt_time(ms: u64) -> String {
    let hours = ms / 3_600_000;
    let minutes = (ms % 3_600_000) / 60_000;
    let seconds = (ms % 60_000) / 1_000;
    let millis = ms % 1_000;
    format!("{:02}:{:02}:{:02}.{:03}", hours, minutes, seconds, millis)
}

pub fn extract_subtitle_tracks(path: &Path) -> Result<Vec<SubtitleTrackInfo>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mkv = MatroskaFile::open(file).map_err(|e| format!("Failed to parse MKV: {:?}", e))?;

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

pub fn extract_subtitle_vtt(path: &Path, track_id: u64) -> Result<String, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut mkv = MatroskaFile::open(file).map_err(|e| format!("Failed to parse MKV: {:?}", e))?;

    // Find the track to verify codec
    let track = mkv
        .tracks()
        .iter()
        .find(|t| t.track_number().get() == track_id)
        .ok_or_else(|| "Subtitle track not found".to_string())?;

    let codec = track.codec_id().to_string();
    if codec != "S_TEXT/UTF8" && codec != "S_TEXT/ASS" && codec != "S_TEXT/SSA" {
        return Err(format!("Unsupported subtitle codec: {}", codec));
    }

    let mut frame = matroska_demuxer::Frame::default();
    let mut cues = Vec::new();

    while let Ok(true) = mkv.next_frame(&mut frame) {
        if frame.track == track_id {
            let start_ms = frame.timestamp;
            let duration_ms = frame.duration.unwrap_or(3000); // fallback to 3s if duration not specified
            let end_ms = start_ms + duration_ms;

            let raw_text = if codec == "S_TEXT/ASS" || codec == "S_TEXT/SSA" {
                let s = String::from_utf8_lossy(&frame.data);
                let parts: Vec<&str> = s.splitn(9, ',').collect();
                if parts.len() == 9 {
                    parts[8].to_string()
                } else {
                    s.into_owned()
                }
            } else {
                String::from_utf8_lossy(&frame.data).into_owned()
            };

            let clean_text = strip_ass_tags(&raw_text);
            cues.push((start_ms, end_ms, clean_text));
        }
    }

    // Sort cues by start time
    cues.sort_by_key(|c| c.0);

    // Build WebVTT string
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
