use crate::domain::torrent::{
    format_hash, AddTorrentResult, AsyncReadSeek, FileDetails, TorrentRepository, TorrentStatusInfo,
};
use crate::error::CoreError;
use async_trait::async_trait;
use librqbit::{AddTorrent, ManagedTorrent, Session};
use std::collections::HashSet;
use std::num::NonZeroU32;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use url::Url;

pub struct RqbitTorrentRepository {
    session: Arc<Session>,
    get_download_dir_fn: Arc<dyn Fn() -> String + Send + Sync>,
    persistence_dir: PathBuf,
    start_time: std::time::Instant,
}

/// 创建基于 librqbit 的种子仓储，由组合根调用。
/// 内部完成 Session 初始化、下载目录闭包构建与持久化目录准备。
pub async fn create_torrent_repository(
    download_dir_lock: Arc<RwLock<PathBuf>>,
    persistence_dir: PathBuf,
) -> Result<Arc<dyn TorrentRepository>, CoreError> {
    tokio::fs::create_dir_all(&persistence_dir).await.ok();

    let mut trackers = std::collections::HashSet::new();
    for url in [
        "udp://tracker.opentrackr.org:1337/announce",
        "udp://open.stealth.si:80/announce",
        "udp://tracker.openbittorrent.com:6969/announce",
        "udp://exodus.desync.com:6969/announce",
        "udp://tracker.moeking.me:6969/announce",
        "http://tracker.opentrackr.org:1337/announce",
    ] {
        if let Ok(u) = Url::parse(url) {
            trackers.insert(u);
        }
    }

    #[allow(unused_mut)]
    let mut opts = librqbit::SessionOptions {
        persistence: Some(librqbit::SessionPersistenceConfig::Json {
            folder: Some(persistence_dir.clone()),
        }),
        disable_dht_persistence: true,
        trackers,
        ..Default::default()
    };
    #[cfg(test)]
    {
        opts.disable_dht = true;
    }
    let download_dir = download_dir_lock.read().unwrap().clone();
    let session = librqbit::Session::new_with_opts(download_dir.clone(), opts).await?;

    let download_dir_fn = {
        let dl = download_dir_lock.clone();
        Arc::new(move || dl.read().unwrap().to_string_lossy().to_string())
    };

    Ok(Arc::new(
        RqbitTorrentRepository::new(session, download_dir_fn, persistence_dir).await,
    ))
}

impl RqbitTorrentRepository {
    pub async fn new(
        session: Arc<Session>,
        get_download_dir_fn: Arc<dyn Fn() -> String + Send + Sync>,
        persistence_dir: PathBuf,
    ) -> Self {
        Self {
            session,
            get_download_dir_fn,
            persistence_dir: persistence_dir.clone(),
            start_time: std::time::Instant::now(),
        }
    }

    fn find_torrent_by_hex(&self, hex_hash: &str) -> Option<Arc<ManagedTorrent>> {
        self.session.with_torrents(|iter| {
            for (_, torrent) in iter {
                let hex = format_hash(&torrent.info_hash().0);
                if hex.eq_ignore_ascii_case(hex_hash) {
                    return Some(torrent.clone());
                }
            }
            None
        })
    }

    async fn get_creation_time(&self, info_hash_hex: &str) -> u64 {
        let target = info_hash_hex.to_lowercase();
        if let Ok(mut entries) = tokio::fs::read_dir(&self.persistence_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                if let Some(name) = entry.file_name().to_str() {
                    if name.to_lowercase().contains(&target) {
                        if let Ok(metadata) = entry.metadata().await {
                            if let Ok(created) = metadata.created().or_else(|_| metadata.modified())
                            {
                                if let Ok(duration) = created.duration_since(std::time::UNIX_EPOCH)
                                {
                                    return duration.as_millis() as u64;
                                }
                            }
                        }
                    }
                }
            }
        }
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }
}

#[async_trait]
impl TorrentRepository for RqbitTorrentRepository {
    async fn add_magnet(
        &self,
        magnet: &str,
        only_files: Option<Vec<usize>>,
    ) -> Result<AddTorrentResult, CoreError> {
        let output_folder = (self.get_download_dir_fn)();
        let options = librqbit::AddTorrentOptions {
            overwrite: true,
            output_folder: Some(output_folder),
            only_files: only_files.clone(),
            ..Default::default()
        };

        let response = self
            .session
            .add_torrent(AddTorrent::from_url(magnet), Some(options))
            .await?;

        let handle = response
            .into_handle()
            .ok_or_else(|| CoreError::Message("Failed to get torrent handle".to_string()))?;

        // Wait with a 20s timeout
        tokio::time::timeout(
            std::time::Duration::from_secs(20),
            handle.wait_until_initialized(),
        )
        .await
        .map_err(|_| {
            CoreError::Message("解析种子元数据超时，可能该种子目前没有在线的做种者".to_string())
        })?
        .map_err(CoreError::from)?;

        let info_hash = format_hash(&handle.info_hash().0);

        let files = handle.with_metadata(|meta| {
            meta.file_infos
                .iter()
                .enumerate()
                .map(|(id, fi)| FileDetails {
                    id,
                    name: fi.relative_filename.to_string_lossy().to_string(),
                    len: fi.len,
                    included: only_files
                        .as_ref()
                        .map(|of| of.contains(&id))
                        .unwrap_or(true),
                })
                .collect::<Vec<_>>()
        })?;

        Ok(AddTorrentResult { info_hash, files })
    }

    async fn list_torrents(&self) -> Vec<TorrentStatusInfo> {
        let is_startup = self.start_time.elapsed().as_secs() < 15;
        let mut torrents: Vec<TorrentStatusInfo> = self.session.with_torrents(|iter| {
            iter.map(|(_, torrent)| {
                let stats = torrent.stats();
                let speed = stats
                    .live
                    .as_ref()
                    .map(|l| (l.download_speed.mbps * 1024.0 * 1024.0) as u64)
                    .unwrap_or(0);
                let upload_speed = stats
                    .live
                    .as_ref()
                    .map(|l| (l.upload_speed.mbps * 1024.0 * 1024.0) as u64)
                    .unwrap_or(0);
                let (peers_connected, peers_total) = stats
                    .live
                    .as_ref()
                    .map(|l| {
                        (
                            l.snapshot.peer_stats.live as u32,
                            l.snapshot.peer_stats.seen as u32,
                        )
                    })
                    .unwrap_or((0, 0));
                let hex = format_hash(&torrent.info_hash().0);
                let finished = stats.finished
                    || (is_startup
                        && matches!(stats.state, librqbit::TorrentStatsState::Initializing));
                TorrentStatusInfo {
                    info_hash: hex,
                    name: torrent.name().unwrap_or_default(),
                    progress_bytes: stats.progress_bytes,
                    total_bytes: stats.total_bytes,
                    finished,
                    download_speed_bytes_per_sec: speed,
                    upload_speed_bytes_per_sec: upload_speed,
                    paused: torrent.is_paused(),
                    peers_connected,
                    peers_total,
                    created_at: 0,
                    subject_id: None,
                    subject_name: None,
                    subject_platform: None,
                }
            })
            .collect()
        });
        for torrent in &mut torrents {
            torrent.created_at = self.get_creation_time(&torrent.info_hash).await;
        }
        torrents
    }

    async fn pause_torrent(&self, info_hash_hex: &str) -> Result<(), CoreError> {
        let torrent = self
            .find_torrent_by_hex(info_hash_hex)
            .ok_or(CoreError::TorrentNotFound)?;
        self.session.pause(&torrent).await?;
        Ok(())
    }

    async fn resume_torrent(&self, info_hash_hex: &str) -> Result<(), CoreError> {
        let torrent = self
            .find_torrent_by_hex(info_hash_hex)
            .ok_or(CoreError::TorrentNotFound)?;
        self.session.unpause(&torrent).await?;
        Ok(())
    }

    async fn delete_torrent(
        &self,
        info_hash_hex: &str,
        delete_files: bool,
    ) -> Result<(), CoreError> {
        use librqbit::api::TorrentIdOrHash;
        let id = TorrentIdOrHash::try_from(info_hash_hex)?;
        self.session.delete(id, delete_files).await?;
        Ok(())
    }

    async fn get_torrent_files(&self, info_hash_hex: &str) -> Option<Vec<FileDetails>> {
        let torrent = self.find_torrent_by_hex(info_hash_hex)?;
        let only_files = torrent.only_files();
        torrent
            .with_metadata(|meta| {
                meta.file_infos
                    .iter()
                    .enumerate()
                    .map(|(id, fi)| FileDetails {
                        id,
                        name: fi.relative_filename.to_string_lossy().to_string(),
                        len: fi.len,
                        included: only_files
                            .as_ref()
                            .map(|of| of.contains(&id))
                            .unwrap_or(true),
                    })
                    .collect::<Vec<_>>()
            })
            .ok()
    }

    async fn get_trackers(&self, info_hash_hex: &str) -> Option<Vec<String>> {
        let torrent = self.find_torrent_by_hex(info_hash_hex)?;
        Some(
            torrent
                .shared()
                .trackers
                .iter()
                .map(|u| u.to_string())
                .collect(),
        )
    }

    async fn update_only_files(
        &self,
        info_hash_hex: &str,
        only_files: HashSet<usize>,
    ) -> Result<(), CoreError> {
        let torrent = self
            .find_torrent_by_hex(info_hash_hex)
            .ok_or(CoreError::TorrentNotFound)?;
        self.session
            .update_only_files(&torrent, &only_files)
            .await
            .map_err(CoreError::from)
    }

    async fn get_file_reader(
        &self,
        info_hash: &str,
        file_id: usize,
    ) -> Result<Box<dyn AsyncReadSeek>, CoreError> {
        let torrent = self
            .find_torrent_by_hex(info_hash)
            .ok_or(CoreError::TorrentNotFound)?;

        let relative_path = torrent
            .with_metadata(|meta| {
                meta.file_infos
                    .get(file_id)
                    .map(|fi| fi.relative_filename.clone())
            })?
            .ok_or_else(|| CoreError::Message("File id not found in metadata".to_string()))?;

        let download_dir = (self.get_download_dir_fn)();
        let absolute_path = std::path::PathBuf::from(download_dir).join(relative_path);

        let tokio_file = tokio::fs::File::open(&absolute_path).await?;
        Ok(Box::new(tokio_file))
    }

    async fn set_max_download_speed(&self, bytes_per_sec: Option<u32>) {
        let bps = bytes_per_sec.and_then(NonZeroU32::new);
        self.session.ratelimits.set_download_bps(bps);
    }

    async fn set_max_upload_speed(&self, bytes_per_sec: Option<u32>) {
        let bps = bytes_per_sec.and_then(NonZeroU32::new);
        self.session.ratelimits.set_upload_bps(bps);
    }
}
