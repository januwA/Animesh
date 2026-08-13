use crate::domain::torrent::TorrentRepository;
use crate::torrent::{
    format_hash, AddTorrentResult, FileDetails, SubjectBinding, TorrentStatusInfo,
};
use async_trait::async_trait;
use librqbit::{AddTorrent, ManagedTorrent, Session};
use std::collections::HashMap;
use std::num::NonZeroU32;
use std::sync::{Arc, RwLock};

use std::path::{Path, PathBuf};

/// 下载资源与条目的绑定关系存储，按 info_hash（小写）唯一标识，
/// 独立 JSON 落盘，保证重启后绑定关系不丢失。
struct SubjectBindingStore {
    path: PathBuf,
    bindings: RwLock<HashMap<String, SubjectBinding>>,
}

impl SubjectBindingStore {
    fn new(persistence_dir: &Path) -> Self {
        let path = persistence_dir.join("subject_bindings.json");
        let bindings = match std::fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => HashMap::new(),
        };
        Self {
            path,
            bindings: RwLock::new(bindings),
        }
    }

    fn get(&self, info_hash: &str) -> Option<SubjectBinding> {
        self.bindings
            .read()
            .unwrap()
            .get(&info_hash.to_lowercase())
            .cloned()
    }

    fn set(&self, info_hash: &str, binding: SubjectBinding) {
        self.bindings
            .write()
            .unwrap()
            .insert(info_hash.to_lowercase(), binding);
        self.persist();
    }

    fn clear(&self, info_hash: &str) {
        self.bindings
            .write()
            .unwrap()
            .remove(&info_hash.to_lowercase());
        self.persist();
    }

    fn persist(&self) {
        let bindings = self.bindings.read().unwrap();
        if let Some(parent) = self.path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(file) = std::fs::File::create(&self.path) {
            let _ = serde_json::to_writer_pretty(file, &*bindings);
        }
    }
}

pub struct RqbitTorrentRepository {
    session: Arc<Session>,
    get_download_dir_fn: Arc<dyn Fn() -> String + Send + Sync>,
    persistence_dir: PathBuf,
    start_time: std::time::Instant,
    subject_bindings: SubjectBindingStore,
}

impl RqbitTorrentRepository {
    pub fn new(
        session: Arc<Session>,
        get_download_dir_fn: Arc<dyn Fn() -> String + Send + Sync>,
        persistence_dir: PathBuf,
    ) -> Self {
        Self {
            session,
            get_download_dir_fn,
            persistence_dir: persistence_dir.clone(),
            start_time: std::time::Instant::now(),
            subject_bindings: SubjectBindingStore::new(&persistence_dir),
        }
    }

    fn get_subject_binding(&self, info_hash_hex: &str) -> Option<SubjectBinding> {
        self.subject_bindings.get(info_hash_hex)
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

    fn get_creation_time(&self, info_hash_hex: &str) -> u64 {
        if let Ok(entries) = std::fs::read_dir(&self.persistence_dir) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.to_lowercase().contains(&info_hash_hex.to_lowercase()) {
                        if let Ok(metadata) = entry.metadata() {
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
    async fn add_magnet(&self, magnet: &str) -> Result<AddTorrentResult, String> {
        let output_folder = (self.get_download_dir_fn)();
        let options = librqbit::AddTorrentOptions {
            overwrite: true,
            output_folder: Some(output_folder),
            ..Default::default()
        };

        let response = self
            .session
            .add_torrent(AddTorrent::from_url(magnet), Some(options))
            .await
            .map_err(|e| format!("Failed to add torrent: {}", e))?;

        let handle = response
            .into_handle()
            .ok_or_else(|| "Failed to get torrent handle".to_string())?;

        // Wait with a 20s timeout
        tokio::time::timeout(
            std::time::Duration::from_secs(20),
            handle.wait_until_initialized(),
        )
        .await
        .map_err(|_| "解析种子元数据超时，可能该种子目前没有在线的做种者".to_string())?
        .map_err(|e| format!("解析种子失败: {}", e))?;

        let info_hash = format_hash(&handle.info_hash().0);
        let name = handle.name().unwrap_or_default();

        let files = handle
            .with_metadata(|meta| {
                meta.file_infos
                    .iter()
                    .enumerate()
                    .map(|(id, fi)| FileDetails {
                        id,
                        name: fi.relative_filename.to_string_lossy().to_string(),
                        len: fi.len,
                    })
                    .collect::<Vec<_>>()
            })
            .map_err(|e| format!("Failed to read metadata: {}", e))?;

        Ok(AddTorrentResult {
            info_hash,
            name,
            files,
        })
    }

    fn get_torrent_status(&self, info_hash_hex: &str) -> Option<TorrentStatusInfo> {
        let torrent = self.find_torrent_by_hex(info_hash_hex)?;
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

        let created_at = self.get_creation_time(info_hash_hex);
        let is_startup = self.start_time.elapsed().as_secs() < 15;
        let finished = stats.finished
            || (is_startup && matches!(stats.state, librqbit::TorrentStatsState::Initializing));

        let trackers = torrent
            .shared()
            .trackers
            .iter()
            .map(|u| u.to_string())
            .collect::<Vec<_>>();

        let binding = self.get_subject_binding(info_hash_hex);

        Some(TorrentStatusInfo {
            info_hash: info_hash_hex.to_string(),
            name: torrent.name().unwrap_or_default(),
            progress_bytes: stats.progress_bytes,
            total_bytes: stats.total_bytes,
            finished,
            download_speed_bytes_per_sec: speed,
            upload_speed_bytes_per_sec: upload_speed,
            paused: torrent.is_paused(),
            peers_connected,
            peers_total,
            created_at,
            trackers,
            subject_id: binding.as_ref().map(|b| b.subject_id),
            subject_name: binding.map(|b| b.subject_name),
        })
    }

    fn list_torrents(&self) -> Vec<TorrentStatusInfo> {
        let is_startup = self.start_time.elapsed().as_secs() < 15;
        self.session.with_torrents(|iter| {
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
                let created_at = self.get_creation_time(&hex);
                let finished = stats.finished
                    || (is_startup
                        && matches!(stats.state, librqbit::TorrentStatsState::Initializing));
                let trackers = torrent
                    .shared()
                    .trackers
                    .iter()
                    .map(|u| u.to_string())
                    .collect::<Vec<_>>();
                let binding = self.get_subject_binding(&hex);
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
                    created_at,
                    trackers,
                    subject_id: binding.as_ref().map(|b| b.subject_id),
                    subject_name: binding.map(|b| b.subject_name),
                }
            })
            .collect()
        })
    }

    async fn pause_torrent(&self, info_hash_hex: &str) -> Result<(), String> {
        let torrent = self
            .find_torrent_by_hex(info_hash_hex)
            .ok_or_else(|| "Torrent not found".to_string())?;
        self.session
            .pause(&torrent)
            .await
            .map_err(|e| format!("Failed to pause torrent: {}", e))?;
        Ok(())
    }

    async fn resume_torrent(&self, info_hash_hex: &str) -> Result<(), String> {
        let torrent = self
            .find_torrent_by_hex(info_hash_hex)
            .ok_or_else(|| "Torrent not found".to_string())?;
        self.session
            .unpause(&torrent)
            .await
            .map_err(|e| format!("Failed to resume torrent: {}", e))?;
        Ok(())
    }

    async fn delete_torrent(&self, info_hash_hex: &str, delete_files: bool) -> Result<(), String> {
        use librqbit::api::TorrentIdOrHash;
        let id = TorrentIdOrHash::try_from(info_hash_hex)
            .map_err(|e| format!("Invalid info hash format: {}", e))?;
        self.session
            .delete(id, delete_files)
            .await
            .map_err(|e| format!("Failed to delete torrent: {}", e))?;
        self.subject_bindings.clear(info_hash_hex);
        Ok(())
    }

    fn get_torrent_files(&self, info_hash_hex: &str) -> Option<Vec<FileDetails>> {
        let torrent = self.find_torrent_by_hex(info_hash_hex)?;
        torrent
            .with_metadata(|meta| {
                meta.file_infos
                    .iter()
                    .enumerate()
                    .map(|(id, fi)| FileDetails {
                        id,
                        name: fi.relative_filename.to_string_lossy().to_string(),
                        len: fi.len,
                    })
                    .collect::<Vec<_>>()
            })
            .ok()
    }

    fn get_file_reader(
        &self,
        info_hash: &str,
        file_id: usize,
    ) -> Result<Box<dyn crate::domain::torrent::AsyncReadSeek>, String> {
        let torrent = self
            .find_torrent_by_hex(info_hash)
            .ok_or_else(|| "Torrent not found".to_string())?;

        let relative_path = torrent
            .with_metadata(|meta| {
                meta.file_infos
                    .get(file_id)
                    .map(|fi| fi.relative_filename.clone())
            })
            .map_err(|e| format!("Failed to get metadata: {}", e))?
            .ok_or_else(|| "File id not found in metadata".to_string())?;

        let download_dir = (self.get_download_dir_fn)();
        let absolute_path = std::path::PathBuf::from(download_dir).join(relative_path);

        let std_file = std::fs::File::open(&absolute_path).map_err(|e| {
            format!(
                "Failed to open local file: {}, path: {:?}",
                e, absolute_path
            )
        })?;
        let tokio_file = tokio::fs::File::from_std(std_file);
        Ok(Box::new(tokio_file))
    }

    fn set_max_download_speed(&self, bytes_per_sec: Option<u32>) {
        let bps = bytes_per_sec.and_then(NonZeroU32::new);
        self.session.ratelimits.set_download_bps(bps);
    }

    fn set_max_upload_speed(&self, bytes_per_sec: Option<u32>) {
        let bps = bytes_per_sec.and_then(NonZeroU32::new);
        self.session.ratelimits.set_upload_bps(bps);
    }

    fn set_subject_binding(&self, info_hash: &str, subject_id: u64, subject_name: String) {
        self.subject_bindings.set(
            info_hash,
            SubjectBinding {
                subject_id,
                subject_name,
            },
        );
    }

    fn clear_subject_binding(&self, info_hash: &str) {
        self.subject_bindings.clear(info_hash);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_persistence_dir() -> PathBuf {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("animesh_test_bindings_{}", nanos))
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_绑定存储_设置读取与清除() {
        let dir = temp_persistence_dir();
        std::fs::create_dir_all(&dir).unwrap();
        let store = SubjectBindingStore::new(&dir);

        let hash = "ABC123";
        assert_eq!(store.get(hash), None);

        store.set(
            hash,
            SubjectBinding {
                subject_id: 42,
                subject_name: "测试条目".to_string(),
            },
        );

        // 大小写不敏感查找
        let binding = store.get("abc123").expect("应能查到绑定");
        assert_eq!(binding.subject_id, 42);
        assert_eq!(binding.subject_name, "测试条目");

        store.clear(hash);
        assert_eq!(store.get(hash), None);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_绑定存储_覆盖已有绑定() {
        let dir = temp_persistence_dir();
        std::fs::create_dir_all(&dir).unwrap();
        let store = SubjectBindingStore::new(&dir);

        store.set(
            "hash1",
            SubjectBinding {
                subject_id: 1,
                subject_name: "旧条目".to_string(),
            },
        );
        store.set(
            "hash1",
            SubjectBinding {
                subject_id: 2,
                subject_name: "新条目".to_string(),
            },
        );

        let binding = store.get("hash1").expect("应能查到绑定");
        assert_eq!(binding.subject_id, 2);
        assert_eq!(binding.subject_name, "新条目");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_绑定存储_持久化跨实例重载() {
        let dir = temp_persistence_dir();
        std::fs::create_dir_all(&dir).unwrap();

        {
            let store = SubjectBindingStore::new(&dir);
            store.set(
                "persist_hash",
                SubjectBinding {
                    subject_id: 99,
                    subject_name: "持久化条目".to_string(),
                },
            );
            assert!(dir.join("subject_bindings.json").exists());
        }

        // 模拟重启：新实例从磁盘重载
        let reloaded = SubjectBindingStore::new(&dir);
        let binding = reloaded.get("PERSIST_HASH").expect("重启后应保留绑定");
        assert_eq!(binding.subject_id, 99);
        assert_eq!(binding.subject_name, "持久化条目");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
