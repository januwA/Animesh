use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct FileDetails {
    pub id: usize,
    pub name: String,
    pub len: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AddTorrentResult {
    pub info_hash: String,
    pub name: Option<String>,
    pub files: Vec<FileDetails>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct TorrentStatusInfo {
    pub info_hash: String,
    pub name: Option<String>,
    pub progress_bytes: u64,
    pub total_bytes: u64,
    pub finished: bool,
    pub download_speed_bytes_per_sec: u64,
}

pub fn format_hash(bytes: &[u8; 20]) -> String {
    bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>()
}

pub fn parse_range(range_str: &str, file_len: u64) -> Option<(u64, u64)> {
    if !range_str.starts_with("bytes=") {
        return None;
    }
    let range_part = &range_str["bytes=".len()..];
    let parts: Vec<&str> = range_part.split('-').collect();
    if parts.len() != 2 {
        return None;
    }
    let start_str = parts[0].trim();
    let end_str = parts[1].trim();

    let start = if start_str.is_empty() {
        return None;
    } else {
        start_str.parse::<u64>().ok()?
    };

    let end = if end_str.is_empty() {
        file_len - 1
    } else {
        end_str.parse::<u64>().ok()?
    };

    if start > end || start >= file_len {
        return None;
    }
    let end = end.min(file_len - 1);

    Some((start, end))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[allow(non_snake_case)]
    fn 测试_解析HTTP_Range_各种格式() {
        assert_eq!(parse_range("bytes=0-100", 1000), Some((0, 100)));
        assert_eq!(parse_range("bytes=100-", 1000), Some((100, 999)));
        assert_eq!(parse_range("bytes=-100", 1000), None);
        assert_eq!(parse_range("invalid", 1000), None);
        assert_eq!(parse_range("bytes=1000-2000", 1000), None);

        // 增加解析错误的分支覆盖
        assert_eq!(parse_range("bytes=abc-100", 1000), None);
        assert_eq!(parse_range("bytes=100-abc", 1000), None);
        assert_eq!(parse_range("bytes=200-100", 1000), None);
        assert_eq!(parse_range("bytes=1000-500", 1000), None);
        assert_eq!(parse_range("bytes=-", 1000), None);
        assert_eq!(parse_range("not_bytes=0-100", 1000), None);
        assert_eq!(parse_range("bytes=0-100-200", 1000), None);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_哈希格式化() {
        let mut test_bytes = [0u8; 20];
        test_bytes[0] = 0x1a;
        test_bytes[19] = 0xff;
        let hex = format_hash(&test_bytes);
        assert!(hex.starts_with("1a"));
        assert!(hex.ends_with("ff"));
        assert_eq!(hex.len(), 40);
    }
}
