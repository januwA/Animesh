use animesh_core::torrent_manager::TorrentManager;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    response::IntoResponse,
    routing::{delete, get, post, put},
    Router,
};
use std::collections::HashMap;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use tokio_stream::StreamExt;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

struct SearchTracker {
    pub handles: Mutex<HashMap<String, tokio::task::AbortHandle>>,
}

impl Default for SearchTracker {
    fn default() -> Self {
        Self {
            handles: Mutex::new(HashMap::new()),
        }
    }
}

struct AppState {
    manager: Arc<TorrentManager>,
    search_tracker: Arc<SearchTracker>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    if std::env::var("RUST_LOG").is_err() {
        std::env::set_var("RUST_LOG", "info");
    }
    env_logger::init();

    log::info!("Starting Animesh Server...");

    // 初始化数据路径
    let app_data_dir = std::env::var("ANIMESH_DATA_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| {
            std::env::current_dir()
                .unwrap_or_else(|_| std::env::temp_dir())
                .join("data")
        });
    std::fs::create_dir_all(&app_data_dir).ok();
    log::info!("Data directory: {:?}", app_data_dir);

    let settings_path = app_data_dir.join("settings.json");
    let mut download_dir = app_data_dir.join("downloads");
    let mut proxy = None;

    if settings_path.exists() {
        if let Ok(file) = std::fs::File::open(&settings_path) {
            if let Ok(settings) =
                serde_json::from_reader::<_, animesh_core::torrent_manager::AppSettings>(file)
            {
                download_dir = std::path::PathBuf::from(settings.download_dir);
                proxy = settings.proxy;
                log::info!("Loaded settings from settings.json");
            }
        }
    } else {
        let settings = animesh_core::torrent_manager::AppSettings {
            download_dir: download_dir.to_string_lossy().to_string(),
            proxy: None,
            trackers: Some(animesh_core::torrent_manager::get_default_trackers()),
            tracker_source_type: None,
            tracker_cdn: None,
            tracker_custom_url: None,
            tracker_auto_update: None,
            tracker_last_update_time: None,
        };
        if let Ok(file) = std::fs::File::create(&settings_path) {
            let _ = serde_json::to_writer_pretty(file, &settings);
            log::info!("Created default settings.json");
        }
    }
    std::fs::create_dir_all(&download_dir).ok();
    log::info!("Download directory: {:?}", download_dir);

    // 默认如果未设置流媒体端口，我们在服务器模式下可以使用 3000
    if std::env::var("ANIMESH_STREAM_PORT").is_err() {
        std::env::set_var("ANIMESH_STREAM_PORT", "3000");
    }

    let manager = TorrentManager::new(download_dir, settings_path, proxy)
        .await
        .expect("Failed to initialize TorrentManager");

    let state = Arc::new(AppState {
        manager: Arc::new(manager),
        search_tracker: Arc::new(SearchTracker::default()),
    });

    // 路由定义
    let api_router = Router::new()
        .route("/torrents/search", get(search_torrents_handler))
        .route("/torrents/search/:trace_id", delete(cancel_search_handler))
        .route("/torrents", post(torrent_add_magnet_handler))
        .route("/torrents", get(torrent_list_handler))
        .route("/torrents/subscribe", get(torrent_subscribe_handler))
        .route("/torrents/:hash/status", get(torrent_get_status_handler))
        .route("/torrents/:hash/files", get(torrent_get_files_handler))
        .route(
            "/torrents/:hash/files/:id/stream-url",
            get(torrent_get_stream_url_handler),
        )
        .route("/torrents/:hash/pause", post(torrent_pause_handler))
        .route("/torrents/:hash/resume", post(torrent_resume_handler))
        .route("/torrents/:hash", delete(torrent_delete_handler))
        .route(
            "/torrents/:hash/files/:id/subtitles",
            get(torrent_get_subtitle_tracks_handler),
        )
        .route(
            "/torrents/:hash/files/:id/subtitles/:track_id",
            get(torrent_get_subtitle_vtt_handler),
        )
        .route("/settings", get(settings_get_handler))
        .route(
            "/settings/download-dir",
            put(settings_set_download_dir_handler),
        )
        .route("/settings/proxy", put(settings_set_proxy_handler))
        .route("/settings/trackers", put(settings_set_trackers_handler))
        .route(
            "/settings/tracker-options",
            put(settings_set_tracker_options_handler),
        )
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state.clone());

    // 静态资源托管
    let dist_dir = std::path::PathBuf::from("dist");
    let app = if dist_dir.exists() {
        log::info!("Serving static files from {:?}", dist_dir);
        let serve_dir =
            ServeDir::new(&dist_dir).fallback(ServeFile::new(dist_dir.join("index.html")));
        Router::new()
            .nest("/api", api_router)
            .fallback_service(serve_dir)
    } else {
        log::info!("Static files directory 'dist' not found. API only mode.");
        Router::new().nest("/api", api_router)
    };

    let server_port = std::env::var("ANIMESH_SERVER_PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .unwrap_or(8080);

    let addr = SocketAddr::from(([0, 0, 0, 0], server_port));
    log::info!("Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// --- Handler 实现 ---

#[derive(serde::Deserialize)]
struct SearchQuery {
    trace_id: String,
    keyword: String,
    engine: String,
}

async fn search_torrents_handler(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let manager = state.manager.clone();
    let tracker = state.search_tracker.clone();
    let trace_id = query.trace_id.clone();
    let keyword = query.keyword.clone();
    let engine = query.engine.clone();

    let task = tokio::spawn(async move {
        let proxy = manager.get_proxy();
        match engine.as_str() {
            "dmhy" => manager.crawler_repo.search_dmhy(&keyword, proxy).await,
            "bangumi_moe" => {
                manager
                    .crawler_repo
                    .search_bangumi_moe(&keyword, proxy)
                    .await
            }
            "mikan" => manager.crawler_repo.search_mikan(&keyword, proxy).await,
            "nyaa" => manager.crawler_repo.search_nyaa(&keyword, proxy).await,
            _ => Err(format!("Unsupported search engine: {}", engine)),
        }
    });

    let abort_handle = task.abort_handle();
    if let Ok(mut handles) = tracker.handles.lock() {
        handles.insert(trace_id.clone(), abort_handle);
    }

    let res = task.await;

    if let Ok(mut handles) = tracker.handles.lock() {
        handles.remove(&trace_id);
    }

    match res {
        Ok(Ok(items)) => Ok(axum::Json(items)),
        Ok(Err(e)) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
        Err(join_err) => {
            if join_err.is_cancelled() {
                Err((StatusCode::BAD_REQUEST, "Search cancelled".to_string()))
            } else {
                Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Search task panicked".to_string(),
                ))
            }
        }
    }
}

async fn cancel_search_handler(
    State(state): State<Arc<AppState>>,
    Path(trace_id): Path<String>,
) -> impl IntoResponse {
    if let Ok(mut handles) = state.search_tracker.handles.lock() {
        if let Some(handle) = handles.remove(&trace_id) {
            handle.abort();
            return (StatusCode::OK, "Cancelled".to_string());
        }
    }
    (StatusCode::NOT_FOUND, "No active search found".to_string())
}

#[derive(serde::Deserialize)]
struct AddMagnetInput {
    magnet: String,
}

async fn torrent_add_magnet_handler(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<AddMagnetInput>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let res = state
        .manager
        .add_magnet(&payload.magnet)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(axum::Json(res))
}

async fn torrent_list_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    axum::Json(state.manager.list_torrents())
}

async fn torrent_subscribe_handler(
    State(state): State<Arc<AppState>>,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>> {
    let manager = state.manager.clone();
    let stream = tokio_stream::wrappers::IntervalStream::new(tokio::time::interval(
        std::time::Duration::from_millis(1500),
    ))
    .map(move |_| {
        let torrents = manager.list_torrents();
        let json = serde_json::to_string(&torrents).unwrap_or_default();
        Ok(Event::default().data(json))
    });

    Sse::new(stream).keep_alive(KeepAlive::default())
}

async fn torrent_get_status_handler(
    State(state): State<Arc<AppState>>,
    Path(info_hash): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let status = state
        .manager
        .get_torrent_status(&info_hash)
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Torrent not found".to_string()))?;
    Ok(axum::Json(status))
}

async fn torrent_get_files_handler(
    State(state): State<Arc<AppState>>,
    Path(info_hash): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let files = state
        .manager
        .get_torrent_files(&info_hash)
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Torrent not found".to_string()))?;
    Ok(axum::Json(files))
}

async fn torrent_get_stream_url_handler(
    State(state): State<Arc<AppState>>,
    Path((info_hash, file_id)): Path<(String, usize)>,
) -> impl IntoResponse {
    let external_url = std::env::var("ANIMESH_EXTERNAL_URL")
        .unwrap_or_else(|_| format!("http://localhost:{}", state.manager.port));
    format!("{}/stream/{}/{}", external_url, info_hash, file_id)
}

async fn torrent_pause_handler(
    State(state): State<Arc<AppState>>,
    Path(info_hash): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .manager
        .pause_torrent(&info_hash)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

async fn torrent_resume_handler(
    State(state): State<Arc<AppState>>,
    Path(info_hash): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .manager
        .resume_torrent(&info_hash)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

#[derive(serde::Deserialize)]
struct DeleteQuery {
    #[serde(rename = "deleteFiles")]
    delete_files: Option<bool>,
}

async fn torrent_delete_handler(
    State(state): State<Arc<AppState>>,
    Path(info_hash): Path<String>,
    Query(query): Query<DeleteQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let delete_files = query.delete_files.unwrap_or(false);
    state
        .manager
        .delete_torrent(&info_hash, delete_files)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

async fn torrent_get_subtitle_tracks_handler(
    State(state): State<Arc<AppState>>,
    Path((info_hash, file_id)): Path<(String, usize)>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let files = state
        .manager
        .get_torrent_files(&info_hash)
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Torrent not found".to_string()))?;
    let file_details = files
        .iter()
        .find(|f| f.id == file_id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, "File not found".to_string()))?;

    let name_lower = file_details.name.to_lowercase();
    if !name_lower.ends_with(".mkv") {
        return Ok(axum::Json(
            Vec::<animesh_core::subtitles::SubtitleTrackInfo>::new(),
        ));
    }

    let stream = state
        .manager
        .torrent_repo
        .get_file_reader(&info_hash, file_id)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to open torrent stream: {}", e),
            )
        })?;
    let sync_reader = animesh_core::subtitles::SyncReader::new(stream);
    let buffered_reader = std::io::BufReader::new(sync_reader);

    match tokio::task::spawn_blocking(move || {
        animesh_core::subtitles::extract_subtitle_tracks_from_reader(buffered_reader)
    })
    .await
    {
        Ok(Ok(tracks)) => Ok(axum::Json(tracks)),
        Ok(Err(e)) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to extract tracks: {}", e),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Task spawn error: {}", e),
        )),
    }
}

async fn torrent_get_subtitle_vtt_handler(
    State(state): State<Arc<AppState>>,
    Path((info_hash, file_id, track_id)): Path<(String, usize, u64)>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let download_dir = state.manager.get_download_dir();
    let files = state
        .manager
        .get_torrent_files(&info_hash)
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Torrent not found".to_string()))?;
    let file_details = files
        .iter()
        .find(|f| f.id == file_id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, "File not found".to_string()))?;

    let path = std::path::PathBuf::from(download_dir).join(&file_details.name);
    if !path.exists() {
        return Err((
            StatusCode::NOT_FOUND,
            "Video file not downloaded or doesn't exist yet".to_string(),
        ));
    }

    match tokio::task::spawn_blocking(move || {
        animesh_core::subtitles::extract_subtitle_vtt(&path, track_id)
    })
    .await
    {
        Ok(Ok(vtt)) => Ok(vtt),
        Ok(Err(e)) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Task spawn error: {}", e),
        )),
    }
}

async fn settings_get_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let settings = state
        .manager
        .get_settings()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(axum::Json(settings))
}

#[derive(serde::Deserialize)]
struct SetDownloadDirInput {
    dir: String,
}

async fn settings_set_download_dir_handler(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<SetDownloadDirInput>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .manager
        .set_download_dir(payload.dir)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

#[derive(serde::Deserialize)]
struct SetProxyInput {
    proxy: Option<String>,
}

async fn settings_set_proxy_handler(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<SetProxyInput>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .manager
        .set_proxy(payload.proxy)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

#[derive(serde::Deserialize)]
struct SetTrackersInput {
    trackers: Vec<String>,
}

async fn settings_set_trackers_handler(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<SetTrackersInput>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .manager
        .set_trackers(payload.trackers)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

#[derive(serde::Deserialize)]
struct SetTrackerOptionsInput {
    source_type: Option<String>,
    cdn: Option<String>,
    custom_url: Option<String>,
    auto_update: Option<bool>,
    last_update_time: Option<i64>,
}

async fn settings_set_tracker_options_handler(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<SetTrackerOptionsInput>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .manager
        .set_tracker_options(
            payload.source_type,
            payload.cdn,
            payload.custom_url,
            payload.auto_update,
            payload.last_update_time,
        )
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}
