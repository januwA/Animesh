use crate::domain::crawler::CrawlerRepository;
use crate::domain::subtitles::VideoMetadata;
use crate::domain::torrent::TorrentRepository;
use crate::hls_proxy::{self, HlsProxyState};
use crate::infrastructure::subtitle_cache::SubtitleCache;
use crate::torrent::{parse_range, AddTorrentResult, FileDetails, TorrentStatusInfo};
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::net::TcpListener;
use tokio_util::io::ReaderStream;

pub struct TorrentManager {
    pub torrent_repo: Arc<dyn TorrentRepository>,
    pub port: u16,
    pub download_dir: Arc<std::sync::RwLock<PathBuf>>,
    pub proxy: Arc<std::sync::RwLock<Option<String>>>,
    pub settings_path: PathBuf,
    pub crawler_repo: Arc<dyn CrawlerRepository + Send + Sync>,
    pub subtitle_cache: Arc<SubtitleCache>,
    pub hls_proxy: HlsProxyState,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AiConfig {
    pub alias: String,
    pub api_endpoint: String,
    pub api_key: String,
    pub ai_model: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    pub download_dir: String,
    pub proxy: Option<String>,
    #[serde(default)]
    pub ai_configs: Option<Vec<AiConfig>>,
    #[serde(default)]
    pub max_download_speed: Option<u32>,
    #[serde(default)]
    pub max_upload_speed: Option<u32>,
}

#[derive(Clone)]
pub struct StreamState {
    pub torrent_repo: Arc<dyn TorrentRepository>,
    pub hls_proxy: HlsProxyState,
}

impl TorrentManager {
    pub async fn new(
        download_dir: PathBuf,
        settings_path: PathBuf,
        proxy: Option<String>,
        max_download_speed: Option<u32>,
        max_upload_speed: Option<u32>,
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

        let download_dir_lock = Arc::new(std::sync::RwLock::new(download_dir.clone()));
        let proxy_lock = Arc::new(std::sync::RwLock::new(proxy));

        let download_dir_fn = {
            let dl = download_dir_lock.clone();
            Arc::new(move || dl.read().unwrap().to_string_lossy().to_string())
        };

        let torrent_repo = Arc::new(
            crate::infrastructure::rqbit_torrent::RqbitTorrentRepository::new(
                session,
                download_dir_fn,
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

        let hls_proxy = HlsProxyState::new(hls_proxy::proxy_base_url(port));

        let stream_state = StreamState {
            torrent_repo: torrent_repo.clone(),
            hls_proxy: hls_proxy.clone(),
        };

        let app = Router::new()
            .route("/stream/:info_hash/:file_id", get(stream_handler))
            .route(hls_proxy::IPTV_PROXY_PATH, get(iptv_proxy_route))
            .layer(cors)
            .with_state(stream_state);

        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        // Apply download speed limit
        if let Some(speed_kbps) = max_download_speed {
            if speed_kbps > 0 {
                let bytes_per_sec = speed_kbps.saturating_mul(1024);
                torrent_repo.set_max_download_speed(Some(bytes_per_sec));
            }
        }

        // Apply upload speed limit
        if let Some(speed_kbps) = max_upload_speed {
            if speed_kbps > 0 {
                let bytes_per_sec = speed_kbps.saturating_mul(1024);
                torrent_repo.set_max_upload_speed(Some(bytes_per_sec));
            }
        }

        let client = Arc::new(crate::infrastructure::http_client::ReqwestHttpClient);
        let crawler_repo =
            Arc::new(crate::infrastructure::http_crawler::HttpCrawlerRepository::new(client));

        Ok(Self {
            torrent_repo,
            port,
            download_dir: download_dir_lock,
            proxy: proxy_lock,
            settings_path,
            crawler_repo,
            subtitle_cache: Arc::new(SubtitleCache::new()),
            hls_proxy,
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
                ai_configs: None,
                max_download_speed: None,
                max_upload_speed: None,
            })
        } else {
            AppSettings {
                download_dir: dir.clone(),
                proxy: self.get_proxy(),
                ai_configs: None,
                max_download_speed: None,
                max_upload_speed: None,
            }
        };
        settings.download_dir = dir;

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
                ai_configs: None,
                max_download_speed: None,
                max_upload_speed: None,
            })
        } else {
            AppSettings {
                download_dir: self.get_download_dir(),
                proxy: proxy.clone(),
                ai_configs: None,
                max_download_speed: None,
                max_upload_speed: None,
            }
        };
        settings.proxy = proxy.clone();

        let file = std::fs::File::create(&self.settings_path)?;
        serde_json::to_writer_pretty(file, &settings)?;

        *self.proxy.write().unwrap() = proxy;
        Ok(())
    }

    pub fn get_settings(&self) -> Result<AppSettings, Box<dyn std::error::Error>> {
        if self.settings_path.exists() {
            let file = std::fs::File::open(&self.settings_path)?;
            let settings: AppSettings = serde_json::from_reader(file)?;
            Ok(settings)
        } else {
            Ok(AppSettings {
                download_dir: self.get_download_dir(),
                proxy: self.get_proxy(),
                ai_configs: None,
                max_download_speed: None,
                max_upload_speed: None,
            })
        }
    }

    pub fn set_ai_configs(
        &self,
        configs: Option<Vec<AiConfig>>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(parent) = self.settings_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut settings = self.get_settings().unwrap_or_else(|_| AppSettings {
            download_dir: self.get_download_dir(),
            proxy: self.get_proxy(),
            ai_configs: None,
            max_download_speed: None,
            max_upload_speed: None,
        });

        settings.ai_configs = configs;

        let file = std::fs::File::create(&self.settings_path)?;
        serde_json::to_writer_pretty(file, &settings)?;
        Ok(())
    }

    pub fn get_max_download_speed(&self) -> Option<u32> {
        self.get_settings().ok().and_then(|s| s.max_download_speed)
    }

    pub fn set_max_download_speed(
        &self,
        max_speed: Option<u32>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Convert KB/s to bytes/s (0/None = unlimited) and apply to session
        self.torrent_repo
            .set_max_download_speed(speed_kbps_to_bytes_per_sec(max_speed));
        self.update_settings(|s| s.max_download_speed = max_speed)
    }

    pub fn get_max_upload_speed(&self) -> Option<u32> {
        self.get_settings().ok().and_then(|s| s.max_upload_speed)
    }

    pub fn set_max_upload_speed(
        &self,
        max_speed: Option<u32>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.torrent_repo
            .set_max_upload_speed(speed_kbps_to_bytes_per_sec(max_speed));
        self.update_settings(|s| s.max_upload_speed = max_speed)
    }

    /// 将设置持久化到 settings.json，未修改的字段保持原值。
    fn update_settings(
        &self,
        apply: impl FnOnce(&mut AppSettings),
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(parent) = self.settings_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut settings = self.get_settings().unwrap_or_else(|_| AppSettings {
            download_dir: self.get_download_dir(),
            proxy: self.get_proxy(),
            ai_configs: None,
            max_download_speed: None,
            max_upload_speed: None,
        });
        apply(&mut settings);

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

    pub fn set_subject_binding(&self, info_hash: &str, subject_id: u64, subject_name: String) {
        self.torrent_repo
            .set_subject_binding(info_hash, subject_id, subject_name);
    }

    pub fn clear_subject_binding(&self, info_hash: &str) {
        self.torrent_repo.clear_subject_binding(info_hash);
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

    /// 提取视频元数据（字幕轨道、媒体信息、章节）。
    pub async fn get_video_metadata(
        &self,
        info_hash: &str,
        file_id: usize,
    ) -> Result<VideoMetadata, String> {
        let download_dir = self.get_download_dir();
        let files = self
            .get_torrent_files(info_hash)
            .ok_or_else(|| "Torrent not found".to_string())?;
        let file_details = files
            .iter()
            .find(|f| f.id == file_id)
            .ok_or_else(|| "File not found".to_string())?;

        let path = PathBuf::from(download_dir).join(&file_details.name);
        if !path.exists() {
            return Err("Video file not downloaded or doesn't exist yet".to_string());
        }
        if !file_details.name.to_lowercase().ends_with(".mkv") {
            return Err("Unsupported video format, metadata extraction requires MKV".to_string());
        }

        crate::infrastructure::matroska_subtitles::extract_video_metadata(&path)
    }

    pub fn get_stream_url(&self, info_hash_hex: &str, file_id: usize) -> String {
        let host = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
        format!(
            "http://{}:{}/stream/{}/{}",
            host, self.port, info_hash_hex, file_id
        )
    }
}

/// 将 KB/s 限速值转换为 bytes/s，0 或 None 表示不限速。
fn speed_kbps_to_bytes_per_sec(speed_kbps: Option<u32>) -> Option<u32> {
    speed_kbps.and_then(|kbps| {
        if kbps == 0 {
            None
        } else {
            Some(kbps.saturating_mul(1024))
        }
    })
}

fn select_best_local_ip(interfaces: Vec<(String, std::net::IpAddr)>) -> Option<String> {
    use std::net::IpAddr;

    let mut best_ip: Option<(String, i32)> = None;

    for (name, ip) in interfaces {
        let ipv4 = match ip {
            IpAddr::V4(v4) => v4,
            _ => continue, // Ignore IPv6 for stream URL compatibility
        };

        // 回环、未指定以及链路本地地址(169.254.x.x / APIPA)均不适合作为流地址，
        // APIPA 是网卡拿不到 DHCP 时的临时地址，随时会失效导致 URL 不可达
        if ipv4.is_loopback() || ipv4.is_unspecified() {
            continue;
        }

        let octets = ipv4.octets();
        let is_link_local = octets[0] == 169 && octets[1] == 254;
        if is_link_local {
            continue;
        }

        let name_lower = name.to_lowercase();
        let mut score = 0;

        let is_private = (octets[0] == 10)
            || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
            || (octets[0] == 192 && octets[1] == 168);

        if is_private {
            score += 10;
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

    // 只返回真实可达的物理网卡地址；虚拟网卡(xray/Tailscale/WSL 等)优先级过低，
    // 若没有更好的候选则视为无可用地址，交由调用方回退到 127.0.0.1
    match best_ip {
        Some((ip, score)) if score >= 0 => Some(ip),
        _ => None,
    }
}

fn get_local_ip() -> Option<String> {
    use local_ip_address::list_afinet_netifas;

    if let Ok(interfaces) = list_afinet_netifas() {
        if let Some(ip) = select_best_local_ip(interfaces) {
            return Some(ip);
        }
    }

    None
}

async fn iptv_proxy_route(
    State(state): State<StreamState>,
    Query(query): Query<hls_proxy::ProxyQuery>,
    headers: HeaderMap,
) -> Response {
    hls_proxy::proxy_request(&state.hls_proxy, &query, &headers).await
}

async fn stream_handler(
    Path((info_hash_hex, file_id)): Path<(String, usize)>,
    State(state): State<StreamState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    let torrent_repo = state.torrent_repo;
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
        let manager = TorrentManager::new(dir, settings_path, None, None, None).await;
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
            .with_state(StreamState {
                torrent_repo: manager.torrent_repo.clone(),
                hls_proxy: HlsProxyState::new(hls_proxy::proxy_base_url(manager.port)),
            });

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
        let manager = TorrentManager::new(dir.clone(), settings_path.clone(), None, None, None)
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
        let manager = TorrentManager::new(dir, settings_path, None, None, None)
            .await
            .unwrap();

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
        let manager = TorrentManager::new(dir, settings_path.clone(), None, None, None)
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
    async fn 测试_上传速度限制_逻辑() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("animesh_test_manager_upload_{}", nanos));
        std::fs::create_dir_all(&dir).unwrap();
        let settings_path = dir.join("settings.json");
        let manager = TorrentManager::new(dir.clone(), settings_path.clone(), None, None, None)
            .await
            .unwrap();

        // 验证初始上传速度限制为空
        assert_eq!(manager.get_max_upload_speed(), None);

        // 修改上传速度限制
        manager.set_max_upload_speed(Some(128)).unwrap();

        // 验证内存更新
        assert_eq!(manager.get_max_upload_speed(), Some(128));

        // 验证设置文件被写入
        assert!(settings_path.exists());
        let content = std::fs::read_to_string(&settings_path).unwrap();
        let parsed: AppSettings = serde_json::from_str(&content).unwrap();
        assert_eq!(parsed.max_upload_speed, Some(128));

        // 验证 0 表示不限速并持久化为 0
        manager.set_max_upload_speed(Some(0)).unwrap();
        assert_eq!(manager.get_max_upload_speed(), Some(0));

        // 验证 None 直接清除限制
        manager.set_max_upload_speed(None).unwrap();
        assert_eq!(manager.get_max_upload_speed(), None);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_将KB每秒限制转换为bytes每秒() {
        assert_eq!(speed_kbps_to_bytes_per_sec(None), None);
        assert_eq!(speed_kbps_to_bytes_per_sec(Some(0)), None);
        assert_eq!(speed_kbps_to_bytes_per_sec(Some(128)), Some(128 * 1024));
        assert_eq!(speed_kbps_to_bytes_per_sec(Some(u32::MAX)), Some(u32::MAX));
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

        // 5. 只有链路本地地址(APIPA 169.254.x.x)时不应选中，应回退到 127.0.0.1
        let link_local_only = vec![(
            "以太网".to_string(),
            "169.254.112.178".parse::<IpAddr>().unwrap(),
        )];
        assert_eq!(super::select_best_local_ip(link_local_only), None);

        // 6. 故障场景：网卡掉线拿到 APIPA 地址 + xray 虚拟隧道，不应返回不可达地址
        let apipa_with_vpn = vec![
            ("xray0".to_string(), "198.18.0.1".parse::<IpAddr>().unwrap()),
            (
                "以太网".to_string(),
                "169.254.112.178".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(super::select_best_local_ip(apipa_with_vpn), None);

        // 7. 链路本地地址与真实局域网地址并存时，选择真实地址
        let link_local_with_real = vec![
            (
                "以太网".to_string(),
                "169.254.112.178".parse::<IpAddr>().unwrap(),
            ),
            (
                "以太网".to_string(),
                "192.168.0.108".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(
            super::select_best_local_ip(link_local_with_real),
            Some("192.168.0.108".to_string())
        );
    }
}
