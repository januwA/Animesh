use animesh_core::application::collection_service::CollectionService;
use animesh_core::application::torrent_manager::{AiConfig, AppSettings, TorrentManager};
use animesh_core::domain::settings::SettingsRepository;
use animesh_core::infrastructure::settings_repository::SqliteSettingsRepository;
use anyhow::Context;
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
use std::sync::{Arc, Mutex, RwLock};
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
    collection_service: Arc<CollectionService>,
    search_tracker: Arc<SearchTracker>,
}

/// 启动时加载或初始化设置。DB 已有记录则读取，否则写入默认值。
async fn load_or_init_settings(
    settings_repo: &Arc<dyn SettingsRepository>,
    app_data_dir: &std::path::Path,
) -> Result<
    (std::path::PathBuf, Option<String>, Option<u32>, Option<u32>),
    animesh_core::error::CoreError,
> {
    // DB 已有记录
    if let Some(existing) = settings_repo.get().await? {
        log::info!("从数据库加载已有设置");
        return Ok((
            std::path::PathBuf::from(existing.download_dir),
            existing.proxy,
            existing.max_download_speed,
            existing.max_upload_speed,
        ));
    }

    // 初始化默认值
    let default_dir = app_data_dir.join("downloads");
    let default_settings = AppSettings {
        download_dir: default_dir.to_string_lossy().to_string(),
        proxy: None,
        ai_configs: None,
        max_download_speed: None,
        max_upload_speed: None,
    };
    settings_repo.ensure_initialized(&default_settings).await?;
    log::info!("使用默认设置初始化数据库");
    Ok((default_dir, None, None, None))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
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
    tokio::fs::create_dir_all(&app_data_dir).await.ok();
    log::info!("Data directory: {:?}", app_data_dir);

    // 默认如果未设置流媒体端口，我们在服务器模式下可以使用 3000
    if std::env::var("ANIMESH_STREAM_PORT").is_err() {
        std::env::set_var("ANIMESH_STREAM_PORT", "3000");
    }

    let db = Arc::new(
        animesh_core::infrastructure::db::AppDatabase::connect(
            &app_data_dir.join("animesh.sqlite"),
        )
        .await
        .context("初始化 AppDatabase 失败")?,
    );

    // 设置仓储：从 DB 加载或初始化默认值
    let settings_repo: Arc<dyn SettingsRepository> = Arc::new(SqliteSettingsRepository::new(&db));
    let (download_dir, proxy, max_download_speed, max_upload_speed) =
        load_or_init_settings(&settings_repo, &app_data_dir).await?;

    tokio::fs::create_dir_all(&download_dir).await.ok();
    log::info!("Download directory: {:?}", download_dir);

    let download_dir_lock = Arc::new(RwLock::new(download_dir));
    let persistence_dir = app_data_dir.join("torrents");
    let torrent_repo = animesh_core::infrastructure::rqbit_torrent::create_torrent_repository(
        download_dir_lock.clone(),
        persistence_dir,
        &db,
    )
    .await
    .context("初始化 TorrentRepository 失败")?;

    let (port, hls_proxy) =
        animesh_core::infrastructure::stream_server::start_stream_server(torrent_repo.clone())
            .await
            .context("初始化流媒体服务器失败")?;

    let crawler_repo = animesh_core::infrastructure::http_crawler::create_crawler_repository();
    let subtitle_cache: Arc<dyn animesh_core::domain::subtitles::SubtitleCache> =
        Arc::new(animesh_core::infrastructure::subtitle_cache::InMemorySubtitleCache::new());
    let subtitle_extractor: Arc<dyn animesh_core::domain::subtitles::SubtitleExtractor> =
        Arc::new(animesh_core::infrastructure::matroska_subtitles::MatroskaSubtitleExtractor);
    let stream_prober: Arc<dyn animesh_core::domain::stream::StreamProber> = Arc::new(hls_proxy);

    let manager = TorrentManager::new(
        download_dir_lock,
        proxy,
        port,
        torrent_repo,
        crawler_repo,
        subtitle_cache,
        subtitle_extractor,
        stream_prober,
        settings_repo,
    );
    // 应用启动时持久化的初始速度限制（DB 已存值）
    manager
        .apply_initial_speed_limits(max_download_speed, max_upload_speed)
        .await;

    let collection_service = CollectionService::new(Arc::new(
        animesh_core::infrastructure::collection_repository::SqliteCollectionRepository::new(&db),
    ));

    let state = Arc::new(AppState {
        manager: Arc::new(manager),
        collection_service: Arc::new(collection_service),
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
        .route("/torrents/:hash/subject", put(torrent_set_subject_handler))
        .route(
            "/torrents/:hash/subject",
            delete(torrent_clear_subject_handler),
        )
        .route("/torrents/:hash", delete(torrent_delete_handler))
        .route(
            "/torrents/:hash/files/:id/metadata",
            get(torrent_get_video_metadata_handler),
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
        .route("/settings/ai-configs", put(settings_set_ai_configs_handler))
        .route(
            "/settings/max-download-speed",
            put(settings_set_max_download_speed_handler),
        )
        .route(
            "/settings/max-upload-speed",
            put(settings_set_max_upload_speed_handler),
        )
        .route("/collections", get(collection_get_all_handler))
        .route("/collections", put(collection_add_handler))
        .route(
            "/collections/:subject_id",
            delete(collection_remove_handler),
        )
        .route("/ai/chat-request", post(ai_chat_request_handler))
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

    let task = tokio::spawn(async move { manager.search(&engine, &keyword).await });

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
        Ok(Err(e)) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
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
    axum::Json(state.manager.list_torrents().await)
}

async fn torrent_subscribe_handler(
    State(state): State<Arc<AppState>>,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>> {
    let manager = state.manager.clone();
    let stream = tokio_stream::wrappers::IntervalStream::new(tokio::time::interval(
        std::time::Duration::from_millis(1500),
    ))
    .then(move |_| {
        let torrents_mgr = manager.clone();
        async move {
            let torrents = torrents_mgr.list_torrents().await;
            let json = serde_json::to_string(&torrents).unwrap_or_default();
            Ok::<_, Infallible>(Event::default().data(json))
        }
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
        .await
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
        .await
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

#[derive(serde::Deserialize)]
struct SetSubjectInput {
    subject_id: u64,
    subject_name: String,
}

async fn torrent_set_subject_handler(
    State(state): State<Arc<AppState>>,
    Path(info_hash): Path<String>,
    axum::Json(payload): axum::Json<SetSubjectInput>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .manager
        .set_subject_binding(&info_hash, payload.subject_id, payload.subject_name)
        .await;
    Ok(StatusCode::OK)
}

async fn torrent_clear_subject_handler(
    State(state): State<Arc<AppState>>,
    Path(info_hash): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state.manager.clear_subject_binding(&info_hash).await;
    Ok(StatusCode::OK)
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

async fn torrent_get_video_metadata_handler(
    State(state): State<Arc<AppState>>,
    Path((info_hash, file_id)): Path<(String, usize)>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let metadata = state
        .manager
        .get_video_metadata(&info_hash, file_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(axum::Json(metadata))
}

async fn torrent_get_subtitle_vtt_handler(
    State(state): State<Arc<AppState>>,
    Path((info_hash, file_id, track_id)): Path<(String, usize, u64)>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let vtt = state
        .manager
        .get_subtitle_vtt(&info_hash, file_id, track_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(vtt)
}

async fn settings_get_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let settings = state
        .manager
        .get_settings()
        .await
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
        .await
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
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

#[derive(serde::Deserialize)]
struct SetAiConfigsInput {
    configs: Option<Vec<AiConfig>>,
}

async fn settings_set_ai_configs_handler(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<SetAiConfigsInput>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .manager
        .set_ai_configs(payload.configs)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

#[derive(serde::Deserialize)]
struct SetMaxDownloadSpeedInput {
    max_speed: Option<u32>,
}

async fn settings_set_max_download_speed_handler(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<SetMaxDownloadSpeedInput>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .manager
        .set_max_download_speed(payload.max_speed)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

#[derive(serde::Deserialize)]
struct SetMaxUploadSpeedInput {
    max_speed: Option<u32>,
}

async fn settings_set_max_upload_speed_handler(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<SetMaxUploadSpeedInput>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .manager
        .set_max_upload_speed(payload.max_speed)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

async fn collection_get_all_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let items = state
        .collection_service
        .list()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(axum::Json(items))
}

#[derive(serde::Deserialize)]
struct CollectionAddInput {
    subject_id: i64,
    name: String,
    image_url: Option<String>,
}

async fn collection_add_handler(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<CollectionAddInput>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .collection_service
        .add(animesh_core::domain::collection::NewCollectionItem {
            subject_id: payload.subject_id,
            name: payload.name,
            image_url: payload.image_url,
        })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

async fn collection_remove_handler(
    State(state): State<Arc<AppState>>,
    Path(subject_id): Path<i64>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .collection_service
        .remove(subject_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

#[derive(serde::Deserialize)]
struct AiChatRequestInput {
    endpoint: String,
    api_key: String,
    body_json: String,
}

async fn ai_chat_request_handler(
    axum::Json(payload): axum::Json<AiChatRequestInput>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let resp =
        animesh_core::send_ai_chat_request(&payload.endpoint, &payload.api_key, &payload.body_json)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(resp)
}
