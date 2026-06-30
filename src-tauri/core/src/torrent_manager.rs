use crate::domain::crawler::CrawlerRepository;
use crate::domain::torrent::TorrentRepository;
use crate::torrent::{parse_range, AddTorrentResult, FileDetails, TorrentStatusInfo};
use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::net::TcpListener;
use tokio_util::io::ReaderStream;

pub fn get_default_trackers() -> Vec<String> {
    vec![
        "udp://tracker.opentrackr.org:1337/announce".to_string(),
        "http://tracker.gbitt.info:80/announce".to_string(),
        "udp://open.stealth.si:80/announce".to_string(),
        "udp://tracker.coppersurfer.tk:6969/announce".to_string(),
        "udp://exodus.desync.com:6969/announce".to_string(),
        "udp://tracker.leechers-paradise.org:6969/announce".to_string(),
        "udp://tracker.internetwarriors.net:1337/announce".to_string(),
        "udp://tracker.cyberia.is:6969/announce".to_string(),
        "udp://tracker.torrent.eu.org:451/announce".to_string(),
        "udp://tracker.moack.co.kr:80/announce".to_string(),
        "udp://explodie.org:6969/announce".to_string(),
        "http://tracker.openbittorrent.com:80/announce".to_string(),
    ]
}

pub struct TorrentManager {
    pub torrent_repo: Arc<dyn TorrentRepository>,
    pub port: u16,
    pub download_dir: Arc<std::sync::RwLock<PathBuf>>,
    pub proxy: Arc<std::sync::RwLock<Option<String>>>,
    pub trackers: Arc<std::sync::RwLock<Vec<String>>>,
    pub settings_path: PathBuf,
    pub crawler_repo: Arc<dyn CrawlerRepository + Send + Sync>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    pub download_dir: String,
    pub proxy: Option<String>,
    #[serde(default)]
    pub trackers: Option<Vec<String>>,
}

impl TorrentManager {
    pub async fn new(
        download_dir: PathBuf,
        settings_path: PathBuf,
        proxy: Option<String>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let persistence_dir = settings_path
            .parent()
            .map(|p| p.join("torrents"))
            .unwrap_or_else(|| download_dir.join(".torrents"));
        std::fs::create_dir_all(&persistence_dir).ok();

        #[allow(unused_mut)]
        let mut opts = librqbit::SessionOptions::default();
        opts.persistence = Some(librqbit::SessionPersistenceConfig::Json {
            folder: Some(persistence_dir),
        });
        opts.disable_dht_persistence = true;
        #[cfg(test)]
        {
            opts.disable_dht = true;
        }
        let session = librqbit::Session::new_with_opts(download_dir.clone(), opts).await?;

        let trackers = if settings_path.exists() {
            if let Ok(file) = std::fs::File::open(&settings_path) {
                if let Ok(settings) = serde_json::from_reader::<_, AppSettings>(file) {
                    settings.trackers.unwrap_or_else(get_default_trackers)
                } else {
                    get_default_trackers()
                }
            } else {
                get_default_trackers()
            }
        } else {
            get_default_trackers()
        };

        let download_dir_lock = Arc::new(std::sync::RwLock::new(download_dir.clone()));
        let proxy_lock = Arc::new(std::sync::RwLock::new(proxy));
        let trackers_lock = Arc::new(std::sync::RwLock::new(trackers));

        let download_dir_fn = {
            let dl = download_dir_lock.clone();
            Arc::new(move || dl.read().unwrap().to_string_lossy().to_string())
        };

        let trackers_fn = {
            let tr = trackers_lock.clone();
            Arc::new(move || tr.read().unwrap().clone())
        };

        let torrent_repo = Arc::new(
            crate::infrastructure::rqbit_torrent::RqbitTorrentRepository::new(
                session,
                download_dir_fn,
                trackers_fn,
            ),
        );

        // 启动 Axum 服务器并监听随机空闲端口
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let port = listener.local_addr()?.port();

        let app = Router::new()
            .route("/stream/:info_hash/:file_id", get(stream_handler))
            .with_state(torrent_repo.clone());

        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        let client = Arc::new(crate::infrastructure::http_client::ReqwestHttpClient);
        let crawler_repo =
            Arc::new(crate::infrastructure::http_crawler::HttpCrawlerRepository::new(client));

        Ok(Self {
            torrent_repo,
            port,
            download_dir: download_dir_lock,
            proxy: proxy_lock,
            trackers: trackers_lock,
            settings_path,
            crawler_repo,
        })
    }

    pub fn get_download_dir(&self) -> String {
        self.download_dir
            .read()
            .unwrap()
            .to_string_lossy()
            .to_string()
    }

    pub fn set_download_dir(&self, dir: String) -> Result<(), Box<dyn std::error::Error>> {
        let path = PathBuf::from(&dir);
        std::fs::create_dir_all(&path)?;

        if let Some(parent) = self.settings_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut settings = if self.settings_path.exists() {
            let file = std::fs::File::open(&self.settings_path)?;
            serde_json::from_reader(file).unwrap_or_else(|_| AppSettings {
                download_dir: dir.clone(),
                proxy: self.get_proxy(),
                trackers: Some(self.get_trackers()),
            })
        } else {
            AppSettings {
                download_dir: dir.clone(),
                proxy: self.get_proxy(),
                trackers: Some(self.get_trackers()),
            }
        };
        settings.download_dir = dir;
        if settings.trackers.is_none() {
            settings.trackers = Some(self.get_trackers());
        }

        let file = std::fs::File::create(&self.settings_path)?;
        serde_json::to_writer_pretty(file, &settings)?;

        *self.download_dir.write().unwrap() = path;
        Ok(())
    }

    pub fn get_proxy(&self) -> Option<String> {
        self.proxy.read().unwrap().clone()
    }

    pub fn set_proxy(&self, proxy: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(parent) = self.settings_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut settings = if self.settings_path.exists() {
            let file = std::fs::File::open(&self.settings_path)?;
            serde_json::from_reader(file).unwrap_or_else(|_| AppSettings {
                download_dir: self.get_download_dir(),
                proxy: proxy.clone(),
                trackers: Some(self.get_trackers()),
            })
        } else {
            AppSettings {
                download_dir: self.get_download_dir(),
                proxy: proxy.clone(),
                trackers: Some(self.get_trackers()),
            }
        };
        settings.proxy = proxy.clone();
        if settings.trackers.is_none() {
            settings.trackers = Some(self.get_trackers());
        }

        let file = std::fs::File::create(&self.settings_path)?;
        serde_json::to_writer_pretty(file, &settings)?;

        *self.proxy.write().unwrap() = proxy;
        Ok(())
    }

    pub fn get_trackers(&self) -> Vec<String> {
        self.trackers.read().unwrap().clone()
    }

    pub fn set_trackers(&self, trackers: Vec<String>) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(parent) = self.settings_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut settings = if self.settings_path.exists() {
            let file = std::fs::File::open(&self.settings_path)?;
            serde_json::from_reader(file).unwrap_or_else(|_| AppSettings {
                download_dir: self.get_download_dir(),
                proxy: self.get_proxy(),
                trackers: Some(trackers.clone()),
            })
        } else {
            AppSettings {
                download_dir: self.get_download_dir(),
                proxy: self.get_proxy(),
                trackers: Some(trackers.clone()),
            }
        };
        settings.trackers = Some(trackers.clone());

        let file = std::fs::File::create(&self.settings_path)?;
        serde_json::to_writer_pretty(file, &settings)?;

        *self.trackers.write().unwrap() = trackers;
        Ok(())
    }

    pub async fn pause_torrent(&self, info_hash_hex: &str) -> Result<(), String> {
        self.torrent_repo.pause_torrent(info_hash_hex).await
    }

    pub async fn resume_torrent(&self, info_hash_hex: &str) -> Result<(), String> {
        self.torrent_repo.resume_torrent(info_hash_hex).await
    }

    pub async fn delete_torrent(
        &self,
        info_hash_hex: &str,
        delete_files: bool,
    ) -> Result<(), String> {
        self.torrent_repo
            .delete_torrent(info_hash_hex, delete_files)
            .await
    }

    pub fn list_torrents(&self) -> Vec<TorrentStatusInfo> {
        self.torrent_repo.list_torrents()
    }

    pub async fn add_magnet(&self, magnet: &str) -> Result<AddTorrentResult, String> {
        self.torrent_repo.add_magnet(magnet).await
    }

    pub fn get_torrent_status(&self, info_hash_hex: &str) -> Option<TorrentStatusInfo> {
        self.torrent_repo.get_torrent_status(info_hash_hex)
    }

    pub fn get_torrent_files(&self, info_hash_hex: &str) -> Option<Vec<FileDetails>> {
        self.torrent_repo.get_torrent_files(info_hash_hex)
    }

    pub fn get_stream_url(&self, info_hash_hex: &str, file_id: usize) -> String {
        format!(
            "http://127.0.0.1:{}/stream/{}/{}",
            self.port, info_hash_hex, file_id
        )
    }
}

async fn stream_handler(
    Path((info_hash_hex, file_id)): Path<(String, usize)>,
    State(torrent_repo): State<Arc<dyn TorrentRepository>>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    let files = torrent_repo
        .get_torrent_files(&info_hash_hex)
        .ok_or(StatusCode::NOT_FOUND)?;
    let file_details = files.get(file_id).ok_or(StatusCode::NOT_FOUND)?;
    let file_len = file_details.len;

    let stream = torrent_repo
        .get_file_reader(&info_hash_hex, file_id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let range_header = headers.get(header::RANGE).and_then(|v| v.to_str().ok());

    let response = if let Some(range) = range_header {
        if let Some(parsed) = parse_range(range, file_len) {
            let (start, end) = parsed;
            let content_length = end - start + 1;

            let mut mut_stream = stream;
            mut_stream
                .seek(SeekFrom::Start(start))
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let limited = mut_stream.take(content_length);
            let body_stream = ReaderStream::new(limited);

            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, "video/mp4".parse().unwrap());
            headers.insert(header::CONTENT_LENGTH, content_length.into());
            headers.insert(
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{}", start, end, file_len)
                    .parse()
                    .unwrap(),
            );
            headers.insert(header::ACCEPT_RANGES, "bytes".parse().unwrap());

            (
                StatusCode::PARTIAL_CONTENT,
                headers,
                Body::from_stream(body_stream),
            )
                .into_response()
        } else {
            return Err(StatusCode::RANGE_NOT_SATISFIABLE);
        }
    } else {
        let body_stream = ReaderStream::new(stream);
        let mut headers = HeaderMap::new();
        headers.insert(header::CONTENT_TYPE, "video/mp4".parse().unwrap());
        headers.insert(header::CONTENT_LENGTH, file_len.into());

        (StatusCode::OK, headers, Body::from_stream(body_stream)).into_response()
    };

    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_种子管理器及流式接口_综合逻辑() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("animesh_test_manager_{}", nanos));
        let settings_path = dir.join("settings.json");
        let manager = TorrentManager::new(dir, settings_path, None).await;
        if let Err(e) = &manager {
            panic!("Manager initialization failed: {:?}", e);
        }
        let manager = manager.unwrap();

        assert!(
            manager.port > 0,
            "Axum should listen on a valid dynamic port"
        );

        // 尝试生成 stream url
        let test_hash = "3a2a3e0f438a2e1d74381395bb0e6840742fef8e";
        let url = manager.get_stream_url(test_hash, 0);
        assert!(
            url.contains(&manager.port.to_string()),
            "Stream URL should include the port"
        );
        assert!(
            url.contains(test_hash),
            "Stream URL should include the info hash"
        );

        // 测试未找到种子时的 get_torrent_status 覆盖
        let status = manager.get_torrent_status(test_hash);
        assert!(status.is_none());

        // 测试 HTTP 流式播放接口_未找到种子
        let app = Router::new()
            .route("/stream/:info_hash/:file_id", get(stream_handler))
            .with_state(manager.torrent_repo.clone());

        use axum::http::Request;
        use tower::ServiceExt;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/stream/3a2a3e0f438a2e1d74381395bb0e6840742fef8e/0")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_自定义下载目录_逻辑() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("animesh_test_manager_settings_{}", nanos));
        let settings_path = dir.join("settings.json");
        let manager = TorrentManager::new(dir.clone(), settings_path.clone(), None)
            .await
            .unwrap();

        // 验证初始下载目录
        assert_eq!(
            manager.get_download_dir(),
            dir.to_string_lossy().to_string()
        );

        // 修改下载目录
        let new_dir = dir.join("custom_downloads");
        let new_dir_str = new_dir.to_string_lossy().to_string();
        manager.set_download_dir(new_dir_str.clone()).unwrap();

        // 验证内存更新
        assert_eq!(manager.get_download_dir(), new_dir_str);

        // 验证设置文件被写入
        assert!(settings_path.exists());
        let content = std::fs::read_to_string(&settings_path).unwrap();
        let parsed: AppSettings = serde_json::from_str(&content).unwrap();
        assert_eq!(parsed.download_dir, new_dir_str);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_种子管理控制_未找到种子时的错误处理() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("animesh_test_manager_control_{}", nanos));
        let settings_path = dir.join("settings.json");
        let manager = TorrentManager::new(dir, settings_path, None).await.unwrap();

        // 验证列表初始为空
        let list = manager.list_torrents();
        assert!(list.is_empty());

        let test_hash = "3a2a3e0f438a2e1d74381395bb0e6840742fef8e";

        // 验证不存在的种子获取文件列表返回 None
        assert!(manager.get_torrent_files(test_hash).is_none());

        // 验证不存在的种子暂停报错
        let res_pause = manager.pause_torrent(test_hash).await;
        assert!(res_pause.is_err());

        // 验证不存在的种子恢复报错
        let res_resume = manager.resume_torrent(test_hash).await;
        assert!(res_resume.is_err());

        // 验证不存在的种子删除报错
        let res_delete = manager.delete_torrent(test_hash, false).await;
        assert!(res_delete.is_err());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_自定义代理_逻辑() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("animesh_test_manager_proxy_{}", nanos));
        std::fs::create_dir_all(&dir).unwrap();
        let settings_path = dir.join("settings.json");
        let manager = TorrentManager::new(dir, settings_path.clone(), None)
            .await
            .unwrap();

        // 验证初始代理为空
        assert_eq!(manager.get_proxy(), None);

        // 修改代理
        let proxy_str = "http://127.0.0.1:7890".to_string();
        manager.set_proxy(Some(proxy_str.clone())).unwrap();

        // 验证内存更新
        assert_eq!(manager.get_proxy(), Some(proxy_str.clone()));

        // 验证设置文件被写入
        assert!(settings_path.exists());
        let content = std::fs::read_to_string(&settings_path).unwrap();
        let parsed: AppSettings = serde_json::from_str(&content).unwrap();
        assert_eq!(parsed.proxy, Some(proxy_str));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_自定义Tracker_逻辑() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("animesh_test_manager_trackers_{}", nanos));
        std::fs::create_dir_all(&dir).unwrap();
        let settings_path = dir.join("settings.json");
        let manager = TorrentManager::new(dir, settings_path.clone(), None)
            .await
            .unwrap();

        // 验证初始 Tracker 列表不为空且包含默认 Tracker
        let initial_trackers = manager.get_trackers();
        assert!(!initial_trackers.is_empty());
        assert!(
            initial_trackers.contains(&"udp://tracker.opentrackr.org:1337/announce".to_string())
        );

        // 修改 Tracker 列表
        let new_trackers = vec!["udp://tracker.new-tracker.com:80/announce".to_string()];
        manager.set_trackers(new_trackers.clone()).unwrap();

        // 验证内存更新
        assert_eq!(manager.get_trackers(), new_trackers);

        // 验证设置文件被写入
        assert!(settings_path.exists());
        let content = std::fs::read_to_string(&settings_path).unwrap();
        let parsed: AppSettings = serde_json::from_str(&content).unwrap();
        assert_eq!(parsed.trackers, Some(new_trackers));
    }
}
