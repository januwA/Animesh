use crate::application::search_use_case::SearchUseCase;
use crate::domain::crawler::SearchResultItem;
use crate::domain::stream::{proxy_base_url, IPTV_PROXY_PATH};
use crate::domain::torrent::{parse_range, TorrentRepository};
use crate::error::CoreResult;
use crate::infrastructure::hls_proxy::{self, HlsProxyState};
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::net::TcpListener;
use tokio_util::io::ReaderStream;

/// 流媒体路由共享状态。
#[derive(Clone)]
pub struct StreamState {
    pub torrent_repo: Arc<dyn TorrentRepository>,
    pub hls_proxy: HlsProxyState,
    pub search_use_case: Arc<SearchUseCase>,
}

/// 绑定内嵌流媒体服务器监听地址。
/// 配置了 ANIMESH_STREAM_PORT 环境变量时使用该固定端口，否则监听随机空闲端口。
pub async fn bind_stream_listener() -> Result<TcpListener, std::io::Error> {
    let stream_addr = if let Ok(port_str) = std::env::var("ANIMESH_STREAM_PORT") {
        if let Ok(p) = port_str.parse::<u16>() {
            format!("0.0.0.0:{p}")
        } else {
            "0.0.0.0:0".to_string()
        }
    } else {
        "0.0.0.0:0".to_string()
    };
    TcpListener::bind(&stream_addr).await
}

/// 构建流媒体路由：视频流接口 + IPTV HLS 代理 + 种子搜索，并配置 CORS 允许 Webview/本地网络访问。
pub fn build_stream_router(state: StreamState) -> Router {
    use tower_http::cors::{Any, CorsLayer};
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/torrent_search", get(torrent_search_handler))
        .route("/stream/:info_hash/:file_id", get(stream_handler))
        .route(IPTV_PROXY_PATH, get(iptv_proxy_route))
        .layer(cors)
        .with_state(state)
}

/// 后台启动流媒体服务器。
pub fn spawn_stream_server(
    listener: TcpListener,
    torrent_repo: Arc<dyn TorrentRepository>,
    hls_proxy: HlsProxyState,
    search_use_case: Arc<SearchUseCase>,
) {
    let app = build_stream_router(StreamState {
        torrent_repo,
        hls_proxy,
        search_use_case,
    });
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
}

/// 由组合根调用：绑定端口 + 创建 HLS 代理 + 启动服务器，返回实际监听端口。
pub async fn start_stream_server(
    torrent_repo: Arc<dyn TorrentRepository>,
    search_use_case: Arc<SearchUseCase>,
) -> CoreResult<(u16, HlsProxyState)> {
    let listener = bind_stream_listener().await?;
    let port = listener.local_addr()?.port();
    let hls_proxy = HlsProxyState::new(proxy_base_url(port));
    spawn_stream_server(listener, torrent_repo, hls_proxy.clone(), search_use_case);
    Ok((port, hls_proxy))
}

#[derive(serde::Deserialize)]
struct TorrentSearchQuery {
    keyword: String,
    engine: String,
}

/// 种子资源搜索接口，按引擎分发请求并返回搜索结果。
async fn torrent_search_handler(
    State(state): State<StreamState>,
    Query(query): Query<TorrentSearchQuery>,
) -> Result<Json<Vec<SearchResultItem>>, (StatusCode, String)> {
    let items = state
        .search_use_case
        .execute(&query.engine, &query.keyword)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(items))
}

/// IPTV HLS 代理入口，转发到 HlsProxyState 处理。
async fn iptv_proxy_route(
    State(state): State<StreamState>,
    Query(query): Query<hls_proxy::ProxyQuery>,
    headers: HeaderMap,
) -> Response {
    hls_proxy::proxy_request(&state.hls_proxy, &query, &headers).await
}

/// 种子内文件流式播放接口，支持 HTTP Range 断点续传。
async fn stream_handler(
    Path((info_hash_hex, file_id)): Path<(String, usize)>,
    State(state): State<StreamState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    let torrent_repo = state.torrent_repo;
    let files = torrent_repo
        .get_torrent_files(&info_hash_hex)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    let file_details = files.get(file_id).ok_or(StatusCode::NOT_FOUND)?;
    let file_len = file_details.len;

    let stream = torrent_repo
        .get_file_reader(&info_hash_hex, file_id)
        .await
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
