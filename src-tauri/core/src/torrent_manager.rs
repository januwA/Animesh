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
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::net::TcpListener;
use tokio_util::io::ReaderStream;

pub struct TorrentManager {
    pub session: Arc<Session>,
    pub port: u16,
}

impl TorrentManager {
    pub async fn new(download_dir: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let session = Session::new(download_dir).await?;

        // 启动 Axum 服务器并监听随机空闲端口
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let port = listener.local_addr()?.port();

        let app = Router::new()
            .route("/stream/:info_hash/:file_id", get(stream_handler))
            .with_state(session.clone());

        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        Ok(Self { session, port })
    }

    pub async fn add_magnet(
        &self,
        magnet: &str,
    ) -> Result<AddTorrentResult, Box<dyn std::error::Error>> {
        let options = librqbit::AddTorrentOptions {
            overwrite: true,
            ..Default::default()
        };
        let response = self
            .session
            .add_torrent(AddTorrent::from_url(magnet), Some(options))
            .await?;
        let handle = response
            .into_handle()
            .ok_or("Failed to get torrent handle")?;

        // 等待种子解析出元数据
        handle.wait_until_initialized().await?;

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
        })
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
        let manager = TorrentManager::new(dir).await;
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
}
