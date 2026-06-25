use crate::torrent::{format_hash, parse_range, AddTorrentResult, FileDetails, TorrentStatusInfo};
use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use librqbit::{AddTorrent, ManagedTorrent, Session};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::net::TcpListener;
use tokio_util::io::ReaderStream;

pub struct TorrentManager {
    pub session: Arc<Session>,
    pub port: u16,
    pub download_dir: Arc<std::sync::RwLock<PathBuf>>,
    pub proxy: Arc<std::sync::RwLock<Option<String>>>,
    pub settings_path: PathBuf,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    pub download_dir: String,
    pub proxy: Option<String>,
}

impl TorrentManager {
    pub async fn new(
        download_dir: PathBuf,
        settings_path: PathBuf,
        proxy: Option<String>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        #[allow(unused_mut)]
        let mut opts = librqbit::SessionOptions::default();
        #[cfg(test)]
        {
            opts.disable_dht = true;
        }
        let session = Session::new_with_opts(download_dir.clone(), opts).await?;

        // 启动 Axum 服务器并监听随机空闲端口
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let port = listener.local_addr()?.port();

        let app = Router::new()
            .route("/stream/:info_hash/:file_id", get(stream_handler))
            .with_state(session.clone());

        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        Ok(Self {
            session,
            port,
            download_dir: Arc::new(std::sync::RwLock::new(download_dir)),
            proxy: Arc::new(std::sync::RwLock::new(proxy)),
            settings_path,
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
            })
        } else {
            AppSettings {
                download_dir: dir.clone(),
                proxy: self.get_proxy(),
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
            })
        } else {
            AppSettings {
                download_dir: self.get_download_dir(),
                proxy: proxy.clone(),
            }
        };
        settings.proxy = proxy.clone();

        let file = std::fs::File::create(&self.settings_path)?;
        serde_json::to_writer_pretty(file, &settings)?;

        *self.proxy.write().unwrap() = proxy;
        Ok(())
    }

    pub async fn pause_torrent(
        &self,
        info_hash_hex: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let torrent = self
            .find_torrent_by_hex(info_hash_hex)
            .ok_or_else(|| "Torrent not found".to_string())?;
        self.session.pause(&torrent).await?;
        Ok(())
    }

    pub async fn resume_torrent(
        &self,
        info_hash_hex: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let torrent = self
            .find_torrent_by_hex(info_hash_hex)
            .ok_or_else(|| "Torrent not found".to_string())?;
        self.session.unpause(&torrent).await?;
        Ok(())
    }

    pub async fn delete_torrent(
        &self,
        info_hash_hex: &str,
        delete_files: bool,
    ) -> Result<(), Box<dyn std::error::Error>> {
        use librqbit::api::TorrentIdOrHash;
        let id = TorrentIdOrHash::try_from(info_hash_hex)?;
        self.session.delete(id, delete_files).await?;
        Ok(())
    }

    pub fn list_torrents(&self) -> Vec<TorrentStatusInfo> {
        self.session.with_torrents(|iter| {
            iter.map(|(_, torrent)| {
                let stats = torrent.stats();
                let speed = stats
                    .live
                    .as_ref()
                    .map(|l| (l.download_speed.mbps * 1024.0 * 1024.0) as u64)
                    .unwrap_or(0);
                let hex = format_hash(&torrent.info_hash().0);
                TorrentStatusInfo {
                    info_hash: hex,
                    name: torrent.name(),
                    progress_bytes: stats.progress_bytes,
                    total_bytes: stats.total_bytes,
                    finished: stats.finished,
                    download_speed_bytes_per_sec: speed,
                    paused: torrent.is_paused(),
                }
            })
            .collect()
        })
    }

    pub async fn add_magnet(
        &self,
        magnet: &str,
    ) -> Result<AddTorrentResult, Box<dyn std::error::Error>> {
        let output_folder = self.get_download_dir();
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
            .ok_or("Failed to get torrent handle")?;

        // 等待种子解析出元数据，设置 20 秒超时防止无限死等
        tokio::time::timeout(
            std::time::Duration::from_secs(20),
            handle.wait_until_initialized(),
        )
        .await
        .map_err(|_| "解析种子元数据超时，可能该种子目前没有在线的做种者")?
        .map_err(|e| format!("解析种子失败: {}", e))?;

        let info_hash = format_hash(&handle.info_hash().0);
        let name = handle.name();

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

    pub fn get_torrent_status(&self, info_hash_hex: &str) -> Option<TorrentStatusInfo> {
        let torrent = self.find_torrent_by_hex(info_hash_hex)?;
        let stats = torrent.stats();

        let speed = stats
            .live
            .as_ref()
            .map(|l| (l.download_speed.mbps * 1024.0 * 1024.0) as u64)
            .unwrap_or(0);

        Some(TorrentStatusInfo {
            info_hash: info_hash_hex.to_string(),
            name: torrent.name(),
            progress_bytes: stats.progress_bytes,
            total_bytes: stats.total_bytes,
            finished: stats.finished,
            download_speed_bytes_per_sec: speed,
            paused: torrent.is_paused(),
        })
    }

    pub fn get_torrent_files(&self, info_hash_hex: &str) -> Option<Vec<FileDetails>> {
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

    pub fn get_stream_url(&self, info_hash_hex: &str, file_id: usize) -> String {
        format!(
            "http://127.0.0.1:{}/stream/{}/{}",
            self.port, info_hash_hex, file_id
        )
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
}

async fn stream_handler(
    Path((info_hash_hex, file_id)): Path<(String, usize)>,
    State(session): State<Arc<Session>>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    let torrent = session
        .with_torrents(|iter| {
            for (_, torrent) in iter {
                let hex = format_hash(&torrent.info_hash().0);
                if hex.eq_ignore_ascii_case(&info_hash_hex) {
                    return Some(torrent.clone());
                }
            }
            None
        })
        .ok_or(StatusCode::NOT_FOUND)?;

    let stream = torrent
        .stream(file_id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let file_len = stream.len();

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
        headers.insert(header::ACCEPT_RANGES, "bytes".parse().unwrap());

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

        // 测试 find_torrent_by_hex
        let torrent = manager.find_torrent_by_hex(test_hash);
        assert!(torrent.is_none());

        // 测试 HTTP 流式播放接口_未找到种子
        let app = Router::new()
            .route("/stream/:info_hash/:file_id", get(stream_handler))
            .with_state(manager.session.clone());

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
}
