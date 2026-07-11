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
    #[serde(default)]
    pub tracker_source_type: Option<String>,
    #[serde(default)]
    pub tracker_cdn: Option<String>,
    #[serde(default)]
    pub tracker_custom_url: Option<String>,
    #[serde(default)]
    pub tracker_auto_update: Option<bool>,
    #[serde(default)]
    pub tracker_last_update_time: Option<i64>,
    #[serde(default)]
    pub ai_enabled: Option<bool>,
    #[serde(default)]
    pub ai_api_key: Option<String>,
    #[serde(default)]
    pub ai_api_endpoint: Option<String>,
    #[serde(default)]
    pub ai_model: Option<String>,
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
                persistence_dir.clone(),
            ),
        );

        // 启动 Axum 服务器并监听端口。如果配置了 ANIMESH_STREAM_PORT 环境变量，则使用该固定端口，否则监听随机空闲端口。
        let stream_addr = if let Ok(port_str) = std::env::var("ANIMESH_STREAM_PORT") {
            if let Ok(p) = port_str.parse::<u16>() {
                format!("0.0.0.0:{}", p)
            } else {
                "0.0.0.0:0".to_string()
            }
        } else {
            "0.0.0.0:0".to_string()
        };
        let listener = TcpListener::bind(&stream_addr).await?;
        let port = listener.local_addr()?.port();

        // 配置 CORS 允许 Webview/本地网络访问流地址
        use tower_http::cors::{Any, CorsLayer};
        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);

        let app = Router::new()
            .route("/stream/:info_hash/:file_id", get(stream_handler))
            .layer(cors)
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
                tracker_source_type: None,
                tracker_cdn: None,
                tracker_custom_url: None,
                tracker_auto_update: None,
                tracker_last_update_time: None,
                ai_enabled: None,
                ai_api_key: None,
                ai_api_endpoint: None,
                ai_model: None,
            })
        } else {
            AppSettings {
                download_dir: dir.clone(),
                proxy: self.get_proxy(),
                trackers: Some(self.get_trackers()),
                tracker_source_type: None,
                tracker_cdn: None,
                tracker_custom_url: None,
                tracker_auto_update: None,
                tracker_last_update_time: None,
                ai_enabled: None,
                ai_api_key: None,
                ai_api_endpoint: None,
                ai_model: None,
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
                tracker_source_type: None,
                tracker_cdn: None,
                tracker_custom_url: None,
                tracker_auto_update: None,
                tracker_last_update_time: None,
                ai_enabled: None,
                ai_api_key: None,
                ai_api_endpoint: None,
                ai_model: None,
            })
        } else {
            AppSettings {
                download_dir: self.get_download_dir(),
                proxy: proxy.clone(),
                trackers: Some(self.get_trackers()),
                tracker_source_type: None,
                tracker_cdn: None,
                tracker_custom_url: None,
                tracker_auto_update: None,
                tracker_last_update_time: None,
                ai_enabled: None,
                ai_api_key: None,
                ai_api_endpoint: None,
                ai_model: None,
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
                tracker_source_type: None,
                tracker_cdn: None,
                tracker_custom_url: None,
                tracker_auto_update: None,
                tracker_last_update_time: None,
                ai_enabled: None,
                ai_api_key: None,
                ai_api_endpoint: None,
                ai_model: None,
            })
        } else {
            AppSettings {
                download_dir: self.get_download_dir(),
                proxy: self.get_proxy(),
                trackers: Some(trackers.clone()),
                tracker_source_type: None,
                tracker_cdn: None,
                tracker_custom_url: None,
                tracker_auto_update: None,
                tracker_last_update_time: None,
                ai_enabled: None,
                ai_api_key: None,
                ai_api_endpoint: None,
                ai_model: None,
            }
        };
        settings.trackers = Some(trackers.clone());

        let file = std::fs::File::create(&self.settings_path)?;
        serde_json::to_writer_pretty(file, &settings)?;

        *self.trackers.write().unwrap() = trackers;
        Ok(())
    }

    pub fn get_settings(&self) -> Result<AppSettings, Box<dyn std::error::Error>> {
        if self.settings_path.exists() {
            let file = std::fs::File::open(&self.settings_path)?;
            let mut settings: AppSettings = serde_json::from_reader(file)?;
            if settings.trackers.is_none() {
                settings.trackers = Some(self.get_trackers());
            }
            Ok(settings)
        } else {
            Ok(AppSettings {
                download_dir: self.get_download_dir(),
                proxy: self.get_proxy(),
                trackers: Some(self.get_trackers()),
                tracker_source_type: None,
                tracker_cdn: None,
                tracker_custom_url: None,
                tracker_auto_update: None,
                tracker_last_update_time: None,
                ai_enabled: None,
                ai_api_key: None,
                ai_api_endpoint: None,
                ai_model: None,
            })
        }
    }

    pub fn set_tracker_options(
        &self,
        source_type: Option<String>,
        cdn: Option<String>,
        custom_url: Option<String>,
        auto_update: Option<bool>,
        last_update_time: Option<i64>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(parent) = self.settings_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut settings = self.get_settings().unwrap_or_else(|_| AppSettings {
            download_dir: self.get_download_dir(),
            proxy: self.get_proxy(),
            trackers: Some(self.get_trackers()),
            tracker_source_type: None,
            tracker_cdn: None,
            tracker_custom_url: None,
            tracker_auto_update: None,
            tracker_last_update_time: None,
            ai_enabled: None,
            ai_api_key: None,
            ai_api_endpoint: None,
            ai_model: None,
        });

        settings.tracker_source_type = source_type;
        settings.tracker_cdn = cdn;
        settings.tracker_custom_url = custom_url;
        settings.tracker_auto_update = auto_update;
        settings.tracker_last_update_time = last_update_time;

        let file = std::fs::File::create(&self.settings_path)?;
        serde_json::to_writer_pretty(file, &settings)?;
        Ok(())
    }

    pub fn set_ai_options(
        &self,
        enabled: Option<bool>,
        api_key: Option<String>,
        api_endpoint: Option<String>,
        model: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(parent) = self.settings_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut settings = self.get_settings().unwrap_or_else(|_| AppSettings {
            download_dir: self.get_download_dir(),
            proxy: self.get_proxy(),
            trackers: Some(self.get_trackers()),
            tracker_source_type: None,
            tracker_cdn: None,
            tracker_custom_url: None,
            tracker_auto_update: None,
            tracker_last_update_time: None,
            ai_enabled: None,
            ai_api_key: None,
            ai_api_endpoint: None,
            ai_model: None,
        });

        settings.ai_enabled = enabled;
        settings.ai_api_key = api_key;
        settings.ai_api_endpoint = api_endpoint;
        settings.ai_model = model;

        let file = std::fs::File::create(&self.settings_path)?;
        serde_json::to_writer_pretty(file, &settings)?;
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
        let host = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
        format!(
            "http://{}:{}/stream/{}/{}",
            host, self.port, info_hash_hex, file_id
        )
    }
}

fn select_best_local_ip(interfaces: Vec<(String, std::net::IpAddr)>) -> Option<String> {
    use std::net::IpAddr;

    let mut best_ip: Option<(String, i32)> = None;

    for (name, ip) in interfaces {
        let ipv4 = match ip {
            IpAddr::V4(v4) => v4,
            _ => continue, // Ignore IPv6 for stream URL compatibility
        };

        if ipv4.is_loopback() || ipv4.is_unspecified() {
            continue;
        }

        let name_lower = name.to_lowercase();
        let mut score = 0;

        let octets = ipv4.octets();
        let is_private = (octets[0] == 10)
            || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
            || (octets[0] == 192 && octets[1] == 168);

        let is_link_local = octets[0] == 169 && octets[1] == 254;

        if is_private {
            score += 10;
        }
        if is_link_local {
            score -= 10;
        }

        let ignore_keywords = [
            "virtual",
            "vbox",
            "vmware",
            "virtualbox",
            "hyper-v",
            "wsl",
            "veth",
            "vethernet",
            "xray",
            "tun",
            "tap",
            "tailscale",
            "zerotier",
            "vpn",
            "ppp",
            "docker",
            "loopback",
        ];

        if ignore_keywords.iter().any(|&kw| name_lower.contains(kw)) {
            score -= 100;
        }

        let wifi_keywords = ["wlan", "wifi", "wi-fi", "wireless", "无线"];
        let ethernet_keywords = ["ethernet", "eth", "以太网", "本地连接", "lan"];

        if wifi_keywords.iter().any(|&kw| name_lower.contains(kw)) {
            score += 50;
        } else if ethernet_keywords.iter().any(|&kw| name_lower.contains(kw)) {
            score += 30;
        }

        let ip_str = ipv4.to_string();
        match &best_ip {
            Some((_, best_score)) => {
                if score > *best_score {
                    best_ip = Some((ip_str, score));
                }
            }
            None => {
                best_ip = Some((ip_str, score));
            }
        }
    }

    best_ip.map(|(ip, _score)| ip)
}

fn get_local_ip() -> Option<String> {
    use local_ip_address::list_afinet_netifas;

    if let Ok(interfaces) = list_afinet_netifas() {
        if let Some(ip) = select_best_local_ip(interfaces) {
            return Some(ip);
        }
    }

    // Fallback: original UdpSocket connection method
    use std::net::UdpSocket;
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip().to_string())
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

    #[test]
    #[allow(non_snake_case)]
    fn 测试_获取局域网IP_逻辑() {
        let ip = get_local_ip();
        if let Some(ref addr) = ip {
            assert_ne!(addr, "0.0.0.0");
            assert_ne!(addr, "127.0.0.1");
            assert_eq!(addr.split('.').count(), 4);
        }
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_选择最佳局域网IP_优先级() {
        use std::net::IpAddr;

        // 1. 用户实际多网卡场景
        let user_interfaces = vec![
            ("xray0".to_string(), "198.18.0.1".parse::<IpAddr>().unwrap()),
            (
                "vEthernet (WSL (Hyper-V firewall))".to_string(),
                "172.31.208.1".parse::<IpAddr>().unwrap(),
            ),
            (
                "WLAN".to_string(),
                "192.168.0.106".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(
            super::select_best_local_ip(user_interfaces),
            Some("192.168.0.106".to_string())
        );

        // 2. 只有回环地址和未指定地址的情况
        let loopback_only = vec![
            ("lo".to_string(), "127.0.0.1".parse::<IpAddr>().unwrap()),
            (
                "unspecified".to_string(),
                "0.0.0.0".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(super::select_best_local_ip(loopback_only), None);

        // 3. 多个物理网卡（无线优先于有线）
        let multiple_physical = vec![
            (
                "以太网".to_string(),
                "192.168.1.100".parse::<IpAddr>().unwrap(),
            ),
            (
                "WLAN".to_string(),
                "192.168.1.101".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(
            super::select_best_local_ip(multiple_physical),
            Some("192.168.1.101".to_string())
        );

        // 4. 普通网卡无特定关键词
        let simple_ip = vec![(
            "my_nic".to_string(),
            "192.168.1.50".parse::<IpAddr>().unwrap(),
        )];
        assert_eq!(
            super::select_best_local_ip(simple_ip),
            Some("192.168.1.50".to_string())
        );
    }
}
