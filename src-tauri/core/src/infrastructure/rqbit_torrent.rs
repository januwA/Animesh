use crate::domain::torrent::{
    format_hash, AddTorrentResult, AsyncReadSeek, FileDetails, SubjectBinding, TorrentRepository,
    TorrentStatusInfo,
};
use crate::error::CoreError;
use crate::infrastructure::db::AppDatabase;
use async_trait::async_trait;
use librqbit::{AddTorrent, ManagedTorrent, Session};
use std::collections::HashMap;
use std::num::NonZeroU32;
use std::sync::{Arc, RwLock};

use std::path::PathBuf;

/// 下载资源与条目的绑定关系存储，按 info_hash（小写）唯一标识。
/// 启动时从 SQLite 加载到内存作为读缓存，写入时直写内存与数据库（失败回滚内存）。
struct SubjectBindingStore {
    bindings: RwLock<HashMap<String, SubjectBinding>>,
    pool: sqlx::SqlitePool,
}

impl SubjectBindingStore {
    async fn new(db: &AppDatabase) -> Self {
        let pool = db.pool().clone();
        let rows = sqlx::query_as::<_, (String, i64, String)>(
            "SELECT info_hash, subject_id, subject_name FROM torrent_subject_bindings",
        )
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
        let mut bindings = HashMap::with_capacity(rows.len());
        for (hash, subject_id, subject_name) in rows {
            bindings.insert(
                hash,
                SubjectBinding {
                    subject_id: subject_id as u64,
                    subject_name,
                },
            );
        }
        Self {
            bindings: RwLock::new(bindings),
            pool,
        }
    }

    fn get(&self, info_hash: &str) -> Option<SubjectBinding> {
        self.bindings
            .read()
            .unwrap()
            .get(&info_hash.to_lowercase())
            .cloned()
    }

    async fn set(&self, info_hash: &str, binding: SubjectBinding) {
        let key = info_hash.to_lowercase();
        {
            let mut bindings = self.bindings.write().unwrap();
            bindings.insert(key.clone(), binding.clone());
        }
        let result = sqlx::query(
            "INSERT INTO torrent_subject_bindings (info_hash, subject_id, subject_name) VALUES (?, ?, ?)
             ON CONFLICT(info_hash) DO UPDATE SET subject_id = excluded.subject_id, subject_name = excluded.subject_name",
        )
        .bind(&key)
        .bind(binding.subject_id as i64)
        .bind(&binding.subject_name)
        .execute(&self.pool)
        .await;
        if result.is_err() {
            self.bindings.write().unwrap().remove(&key);
        }
    }

    async fn clear(&self, info_hash: &str) {
        let key = info_hash.to_lowercase();
        let removed = self.bindings.write().unwrap().remove(&key);
        let result = sqlx::query("DELETE FROM torrent_subject_bindings WHERE info_hash = ?")
            .bind(&key)
            .execute(&self.pool)
            .await;
        if result.is_err() {
            if let Some(binding) = removed {
                self.bindings.write().unwrap().insert(key, binding);
            }
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

/// 创建基于 librqbit 的种子仓储，由组合根调用。
/// 内部完成 Session 初始化、下载目录闭包构建与持久化目录准备。
pub async fn create_torrent_repository(
    download_dir_lock: Arc<RwLock<PathBuf>>,
    persistence_dir: PathBuf,
    db: &AppDatabase,
) -> Result<Arc<dyn TorrentRepository>, CoreError> {
    std::fs::create_dir_all(&persistence_dir).ok();

    #[allow(unused_mut)]
    let mut opts = librqbit::SessionOptions {
        persistence: Some(librqbit::SessionPersistenceConfig::Json {
            folder: Some(persistence_dir.clone()),
        }),
        disable_dht_persistence: true,
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
        RqbitTorrentRepository::new(session, download_dir_fn, persistence_dir, db).await,
    ))
}

impl RqbitTorrentRepository {
    pub async fn new(
        session: Arc<Session>,
        get_download_dir_fn: Arc<dyn Fn() -> String + Send + Sync>,
        persistence_dir: PathBuf,
        db: &AppDatabase,
    ) -> Self {
        Self {
            session,
            get_download_dir_fn,
            persistence_dir: persistence_dir.clone(),
            start_time: std::time::Instant::now(),
            subject_bindings: SubjectBindingStore::new(db).await,
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
    async fn add_magnet(&self, magnet: &str) -> Result<AddTorrentResult, CoreError> {
        let output_folder = (self.get_download_dir_fn)();
        let options = librqbit::AddTorrentOptions {
            overwrite: true,
            output_folder: Some(output_folder),
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
        let name = handle.name().unwrap_or_default();

        let files = handle.with_metadata(|meta| {
            meta.file_infos
                .iter()
                .enumerate()
                .map(|(id, fi)| FileDetails {
                    id,
                    name: fi.relative_filename.to_string_lossy().to_string(),
                    len: fi.len,
                })
                .collect::<Vec<_>>()
        })?;

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
        self.subject_bindings.clear(info_hash_hex).await;
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

        let std_file = std::fs::File::open(&absolute_path)?;
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

    async fn set_subject_binding(&self, info_hash: &str, subject_id: u64, subject_name: String) {
        self.subject_bindings
            .set(
                info_hash,
                SubjectBinding {
                    subject_id,
                    subject_name,
                },
            )
            .await;
    }

    async fn clear_subject_binding(&self, info_hash: &str) {
        self.subject_bindings.clear(info_hash).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::db::AppDatabase;

    async fn setup_store() -> SubjectBindingStore {
        let db = AppDatabase::connect_in_memory()
            .await
            .expect("内存库应成功");
        SubjectBindingStore::new(&db).await
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_绑定存储_设置读取与清除() {
        let store = setup_store().await;

        let hash = "ABC123";
        assert_eq!(store.get(hash), None);

        store
            .set(
                hash,
                SubjectBinding {
                    subject_id: 42,
                    subject_name: "测试条目".to_string(),
                },
            )
            .await;

        // 大小写不敏感查找
        let binding = store.get("abc123").expect("应能查到绑定");
        assert_eq!(binding.subject_id, 42);
        assert_eq!(binding.subject_name, "测试条目");

        store.clear(hash).await;
        assert_eq!(store.get(hash), None);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_绑定存储_覆盖已有绑定() {
        let store = setup_store().await;

        store
            .set(
                "hash1",
                SubjectBinding {
                    subject_id: 1,
                    subject_name: "旧条目".to_string(),
                },
            )
            .await;
        store
            .set(
                "hash1",
                SubjectBinding {
                    subject_id: 2,
                    subject_name: "新条目".to_string(),
                },
            )
            .await;

        let binding = store.get("hash1").expect("应能查到绑定");
        assert_eq!(binding.subject_id, 2);
        assert_eq!(binding.subject_name, "新条目");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_绑定存储_持久化跨实例重载() {
        let db = AppDatabase::connect_in_memory()
            .await
            .expect("内存库应成功");
        {
            let store = SubjectBindingStore::new(&db).await;
            store
                .set(
                    "persist_hash",
                    SubjectBinding {
                        subject_id: 99,
                        subject_name: "持久化条目".to_string(),
                    },
                )
                .await;
        }

        // 模拟重启：新实例从数据库重载
        let reloaded = SubjectBindingStore::new(&db).await;
        let binding = reloaded.get("PERSIST_HASH").expect("重启后应保留绑定");
        assert_eq!(binding.subject_id, 99);
        assert_eq!(binding.subject_name, "持久化条目");
    }
}
