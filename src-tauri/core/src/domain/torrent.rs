use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::error::CoreError;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct FileDetails {
    pub id: usize,
    pub name: String,
    pub len: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AddTorrentResult {
    pub info_hash: String,
    pub files: Vec<FileDetails>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct TorrentStatusInfo {
    pub info_hash: String,
    pub name: String,
    pub progress_bytes: u64,
    pub total_bytes: u64,
    pub finished: bool,
    pub download_speed_bytes_per_sec: u64,
    pub upload_speed_bytes_per_sec: u64,
    pub paused: bool,
    pub peers_connected: u32,
    pub peers_total: u32,
    pub created_at: u64,
    #[serde(default)]
    pub trackers: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_id: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_platform: Option<String>,
}

/// 下载资源与条目的绑定信息。
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SubjectBinding {
    pub subject_id: u64,
    pub platform: String,
    pub subject_name: String,
}

pub trait AsyncReadSeek: tokio::io::AsyncRead + tokio::io::AsyncSeek + Unpin + Send {}
impl<T: tokio::io::AsyncRead + tokio::io::AsyncSeek + Unpin + Send> AsyncReadSeek for T {}

#[async_trait]
pub trait TorrentRepository: Send + Sync {
    async fn add_magnet(&self, magnet: &str) -> Result<AddTorrentResult, CoreError>;
    async fn list_torrents(&self) -> Vec<TorrentStatusInfo>;
    async fn pause_torrent(&self, info_hash: &str) -> Result<(), CoreError>;
    async fn resume_torrent(&self, info_hash: &str) -> Result<(), CoreError>;
    async fn delete_torrent(&self, info_hash: &str, delete_files: bool) -> Result<(), CoreError>;
    async fn get_torrent_files(&self, info_hash: &str) -> Option<Vec<FileDetails>>;

    async fn get_file_reader(
        &self,
        info_hash: &str,
        file_id: usize,
    ) -> Result<Box<dyn AsyncReadSeek>, CoreError>;

    async fn set_max_download_speed(&self, bytes_per_sec: Option<u32>);

    async fn set_max_upload_speed(&self, bytes_per_sec: Option<u32>);
}

/// 下载资源与条目绑定关系的仓储。
#[async_trait]
pub trait SubjectBindingRepository: Send + Sync {
    async fn get(&self, info_hash: &str, platform: &str) -> Option<SubjectBinding>;

    /// 绑定下载资源到条目。已存在同平台绑定时会覆盖。
    async fn set(&self, info_hash: &str, binding: SubjectBinding);

    /// 解除下载资源与指定平台条目的绑定。
    async fn clear(&self, info_hash: &str, platform: &str);

    /// 解除下载资源与所有平台条目的绑定（删除种子时调用）。
    async fn clear_all(&self, info_hash: &str);
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
