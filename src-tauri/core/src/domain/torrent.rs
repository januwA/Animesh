use crate::torrent::{AddTorrentResult, FileDetails, TorrentStatusInfo};
use async_trait::async_trait;

pub trait AsyncReadSeek: tokio::io::AsyncRead + tokio::io::AsyncSeek + Unpin + Send {}
impl<T: tokio::io::AsyncRead + tokio::io::AsyncSeek + Unpin + Send> AsyncReadSeek for T {}

#[async_trait]
pub trait TorrentRepository: Send + Sync {
    async fn add_magnet(&self, magnet: &str) -> Result<AddTorrentResult, String>;
    fn get_torrent_status(&self, info_hash: &str) -> Option<TorrentStatusInfo>;
    fn list_torrents(&self) -> Vec<TorrentStatusInfo>;
    async fn pause_torrent(&self, info_hash: &str) -> Result<(), String>;
    async fn resume_torrent(&self, info_hash: &str) -> Result<(), String>;
    async fn delete_torrent(&self, info_hash: &str, delete_files: bool) -> Result<(), String>;
    fn get_torrent_files(&self, info_hash: &str) -> Option<Vec<FileDetails>>;

    fn get_file_reader(
        &self,
        info_hash: &str,
        file_id: usize,
    ) -> Result<Box<dyn AsyncReadSeek>, String>;
}
