use crate::domain::torrent::{AddTorrentResult, FileDetails, TorrentRepository, TorrentStatusInfo};
use crate::error::CoreResult;
use std::sync::Arc;

/// 种子下载领域用例。
///
/// 仅负责种子资源的增删改查与条目绑定,所有外部依赖通过 `TorrentRepository` 抽象注入。
/// 设置、搜索、字幕、流媒体等用例已拆分至各自的 Service。
pub struct TorrentManager {
    torrent_repo: Arc<dyn TorrentRepository>,
}

impl TorrentManager {
    pub fn new(torrent_repo: Arc<dyn TorrentRepository>) -> Self {
        Self { torrent_repo }
    }

    pub async fn add_magnet(&self, magnet: &str) -> CoreResult<AddTorrentResult> {
        self.torrent_repo.add_magnet(magnet).await
    }

    pub async fn pause_torrent(&self, info_hash_hex: &str) -> CoreResult<()> {
        self.torrent_repo.pause_torrent(info_hash_hex).await
    }

    pub async fn resume_torrent(&self, info_hash_hex: &str) -> CoreResult<()> {
        self.torrent_repo.resume_torrent(info_hash_hex).await
    }

    pub async fn delete_torrent(&self, info_hash_hex: &str, delete_files: bool) -> CoreResult<()> {
        self.torrent_repo
            .delete_torrent(info_hash_hex, delete_files)
            .await
    }

    pub async fn list_torrents(&self) -> Vec<TorrentStatusInfo> {
        self.torrent_repo.list_torrents().await
    }

    pub async fn get_torrent_status(&self, info_hash_hex: &str) -> Option<TorrentStatusInfo> {
        self.torrent_repo.get_torrent_status(info_hash_hex).await
    }

    pub async fn get_torrent_files(&self, info_hash_hex: &str) -> Option<Vec<FileDetails>> {
        self.torrent_repo.get_torrent_files(info_hash_hex).await
    }

    pub async fn set_subject_binding(
        &self,
        info_hash: &str,
        subject_id: u64,
        subject_name: String,
    ) {
        self.torrent_repo
            .set_subject_binding(info_hash, subject_id, subject_name)
            .await;
    }

    pub async fn clear_subject_binding(&self, info_hash: &str) {
        self.torrent_repo.clear_subject_binding(info_hash).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::db::AppDatabase;
    use crate::infrastructure::rqbit_torrent::create_torrent_repository;
    use crate::infrastructure::test_mocks::{temp_dir, MockTorrentRepository};
    use std::path::PathBuf;
    use std::sync::RwLock;

    /// 使用真实基础设施(内存 SQLite + 真实 librqbit 会话)构造测试管理器。
    async fn build_manager(
        dir: PathBuf,
    ) -> CoreResult<(TorrentManager, Arc<dyn TorrentRepository>)> {
        let download_dir_lock: Arc<RwLock<PathBuf>> = Arc::new(RwLock::new(dir.clone()));
        let db = Arc::new(
            AppDatabase::connect_in_memory()
                .await
                .expect("内存库应成功"),
        );
        let persistence_dir = dir.join(".torrents");
        let torrent_repo =
            create_torrent_repository(download_dir_lock, persistence_dir, &db).await?;
        let manager = TorrentManager::new(torrent_repo.clone());
        Ok((manager, torrent_repo))
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_添加磁力链接_委托仓储并返回结果() {
        let repo = MockTorrentRepository::default().with_add_result(Ok(AddTorrentResult {
            info_hash: "abc123".to_string(),
            name: "示例资源".to_string(),
            files: vec![FileDetails {
                id: 0,
                name: "a.mkv".to_string(),
                len: 1024,
            }],
        }));
        let manager = TorrentManager::new(Arc::new(repo));

        let res = manager.add_magnet("magnet:?xt=urn:btih:abc").await;
        let res = res.expect("添加应成功");
        assert_eq!(res.info_hash, "abc123");
        assert_eq!(res.files.len(), 1);

        let repo_err =
            MockTorrentRepository::default().with_add_result(Err("添加失败".to_string().into()));
        let manager_err = TorrentManager::new(Arc::new(repo_err));
        assert!(manager_err.add_magnet("magnet").await.is_err());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_设置与清除条目绑定_委托仓储() {
        let repo = Arc::new(MockTorrentRepository::default());
        let bindings = repo.subject_bindings.clone();
        let cleared = repo.cleared.clone();
        let manager = TorrentManager::new(repo);

        manager
            .set_subject_binding("hash1", 42, "进击的巨人".to_string())
            .await;
        manager.clear_subject_binding("hash1").await;

        assert_eq!(bindings.lock().unwrap().len(), 1);
        assert_eq!(bindings.lock().unwrap()[0].1, 42);
        assert_eq!(*cleared.lock().unwrap(), vec!["hash1".to_string()]);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_种子管理控制_未找到种子时的错误处理() {
        let dir = temp_dir("manager_control");
        let (manager, _) = build_manager(dir).await.expect("初始化应成功");

        assert!(manager.list_torrents().await.is_empty());

        let test_hash = "3a2a3e0f438a2e1d74381395bb0e6840742fef8e";

        assert!(manager.get_torrent_files(test_hash).await.is_none());
        assert!(manager.pause_torrent(test_hash).await.is_err());
        assert!(manager.resume_torrent(test_hash).await.is_err());
        assert!(manager.delete_torrent(test_hash, false).await.is_err());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_种子控制操作_委托仓储() {
        let repo = Arc::new(
            MockTorrentRepository::default().with_status(TorrentStatusInfo {
                info_hash: "hash1".to_string(),
                name: "资源".to_string(),
                progress_bytes: 0,
                total_bytes: 100,
                finished: false,
                download_speed_bytes_per_sec: 0,
                upload_speed_bytes_per_sec: 0,
                paused: false,
                peers_connected: 0,
                peers_total: 0,
                created_at: 0,
                trackers: vec![],
                subject_id: None,
                subject_name: None,
            }),
        );
        let manager = TorrentManager::new(repo);

        assert_eq!(manager.list_torrents().await.len(), 1);
        assert!(manager.get_torrent_status("hash1").await.is_some());
        assert!(manager.pause_torrent("hash1").await.is_ok());
        assert!(manager.resume_torrent("hash1").await.is_ok());
        assert!(manager.delete_torrent("hash1", false).await.is_ok());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_种子管理器_流式接口未找到种子返回404() {
        use crate::infrastructure::hls_proxy::HlsProxyState;
        use crate::infrastructure::stream_server::{build_stream_router, StreamState};

        let dir = temp_dir("manager_stream_404");
        let (manager, torrent_repo) = build_manager(dir).await.expect("初始化应成功");

        let test_hash = "3a2a3e0f438a2e1d74381395bb0e6840742fef8e";

        // 未找到种子时的 get_torrent_status 覆盖
        assert!(manager.get_torrent_status(test_hash).await.is_none());

        // 测试 HTTP 流式播放接口_未找到种子
        let hls_proxy = HlsProxyState::new(crate::domain::stream::proxy_base_url(0));
        let app = build_stream_router(StreamState {
            torrent_repo,
            hls_proxy,
        });

        use axum::body::Body;
        use tower::ServiceExt;
        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .uri(format!("/stream/{}/0", test_hash))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), axum::http::StatusCode::NOT_FOUND);
    }
}
