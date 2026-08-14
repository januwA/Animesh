// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use animesh_core::application::collection_service::CollectionService;
use animesh_core::application::torrent_manager::{AiConfig, AppSettings, TorrentManager};
use animesh_core::domain::collection::CollectionRecord;
use animesh_core::domain::crawler::SearchResultItem;
use animesh_core::domain::subtitles::VideoMetadata;
use animesh_core::domain::torrent::{AddTorrentResult, FileDetails, TorrentStatusInfo};
use animesh_core::error::CoreError;
use anyhow::Context;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use tauri::Manager;

pub fn trace_log(msg: &str) {
    log::info!("[TRACE] {}", msg);
}

pub struct SearchTracker {
    pub handles: Mutex<HashMap<String, tokio::task::AbortHandle>>,
}

impl Default for SearchTracker {
    fn default() -> Self {
        Self {
            handles: Mutex::new(HashMap::new()),
        }
    }
}

pub struct AddMagnetTracker {
    pub handles: Mutex<HashMap<String, tokio::task::AbortHandle>>,
}

impl Default for AddMagnetTracker {
    fn default() -> Self {
        Self {
            handles: Mutex::new(HashMap::new()),
        }
    }
}

pub struct SubscriptionTracker {
    // Maps subscription_id to (window_label, session_id)
    pub subscriptions: Arc<Mutex<HashMap<String, (String, String)>>>,
}

impl Default for SubscriptionTracker {
    fn default() -> Self {
        Self {
            subscriptions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
fn cancel_search(trace_id: String, tracker: tauri::State<'_, SearchTracker>) {
    trace_log(&format!(
        "Entering cancel_search command, trace_id: {}",
        trace_id
    ));
    if let Ok(mut handles) = tracker.handles.lock() {
        if let Some(handle) = handles.remove(&trace_id) {
            handle.abort();
            trace_log(&format!(
                "Successfully aborted search for trace_id: {}",
                trace_id
            ));
        } else {
            trace_log(&format!(
                "No active search found to abort for trace_id: {}",
                trace_id
            ));
        }
    }
}

#[tauri::command]
async fn search_torrents(
    trace_id: String,
    keyword: &str,
    engine: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
    tracker: tauri::State<'_, SearchTracker>,
) -> Result<Vec<SearchResultItem>, CoreError> {
    trace_log(&format!(
        "Entering search_torrents command, trace_id: {}, keyword: {}, engine: {}",
        trace_id, keyword, engine
    ));

    let manager_clone = manager.inner().clone();
    let keyword_string = keyword.to_string();
    let engine_string = engine.to_string();

    let task =
        tokio::spawn(async move { manager_clone.search(&engine_string, &keyword_string).await });

    let abort_handle = task.abort_handle();
    if let Ok(mut handles) = tracker.handles.lock() {
        handles.insert(trace_id.clone(), abort_handle);
    }

    let res = task.await;

    if let Ok(mut handles) = tracker.handles.lock() {
        handles.remove(&trace_id);
    }

    match res {
        Ok(inner_res) => {
            match &inner_res {
                Ok(items) => trace_log(&format!(
                    "search_torrents completed successfully, found {} items",
                    items.len()
                )),
                Err(e) => trace_log(&format!("search_torrents failed with error: {}", e)),
            }
            inner_res
        }
        Err(join_err) => {
            if join_err.is_cancelled() {
                trace_log(&format!(
                    "search_torrents was cancelled, trace_id: {}",
                    trace_id
                ));
                Err(CoreError::Message("Search cancelled".to_string()))
            } else {
                trace_log(&format!("search_torrents task panicked: {:?}", join_err));
                Err(CoreError::Message("Search task panicked".to_string()))
            }
        }
    }
}

#[tauri::command]
async fn torrent_add_magnet(
    trace_id: String,
    magnet: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
    tracker: tauri::State<'_, AddMagnetTracker>,
) -> Result<AddTorrentResult, CoreError> {
    trace_log(&format!(
        "Entering torrent_add_magnet command, trace_id: {}, magnet length: {}",
        trace_id,
        magnet.len()
    ));
    let clean_magnet = if magnet.len() > 60 {
        format!("{}...{}", &magnet[0..40], &magnet[magnet.len() - 20..])
    } else {
        magnet.to_string()
    };
    trace_log(&format!("Processed magnet string: {}", clean_magnet));

    let manager_clone = manager.inner().clone();
    let magnet_string = magnet.to_string();

    let task = tokio::spawn(async move { manager_clone.add_magnet(&magnet_string).await });

    let abort_handle = task.abort_handle();
    if let Ok(mut handles) = tracker.handles.lock() {
        handles.insert(trace_id.clone(), abort_handle);
    }

    let res = task.await;

    if let Ok(mut handles) = tracker.handles.lock() {
        handles.remove(&trace_id);
    }

    match res {
        Ok(inner) => {
            match &inner {
                Ok(t) => trace_log(&format!(
                    "torrent_add_magnet succeeded, info_hash: {}, files count: {}",
                    t.info_hash,
                    t.files.len()
                )),
                Err(e) => trace_log(&format!("torrent_add_magnet failed with error: {}", e)),
            }
            inner
        }
        Err(join_err) => {
            if join_err.is_cancelled() {
                trace_log(&format!(
                    "torrent_add_magnet was cancelled, trace_id: {}",
                    trace_id
                ));
                Err(CoreError::Message("添加磁力链接已取消".to_string()))
            } else {
                trace_log(&format!("torrent_add_magnet task panicked: {:?}", join_err));
                Err(CoreError::Message("添加磁力链接任务异常".to_string()))
            }
        }
    }
}

#[tauri::command]
fn cancel_add_magnet(trace_id: String, tracker: tauri::State<'_, AddMagnetTracker>) {
    trace_log(&format!(
        "Entering cancel_add_magnet command, trace_id: {}",
        trace_id
    ));
    if let Ok(mut handles) = tracker.handles.lock() {
        if let Some(handle) = handles.remove(&trace_id) {
            handle.abort();
            trace_log(&format!(
                "Successfully aborted add_magnet for trace_id: {}",
                trace_id
            ));
        } else {
            trace_log(&format!(
                "No active add_magnet found to abort for trace_id: {}",
                trace_id
            ));
        }
    }
}

#[tauri::command]
async fn torrent_get_status(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<TorrentStatusInfo, CoreError> {
    manager
        .get_torrent_status(info_hash)
        .await
        .ok_or(CoreError::TorrentNotFound)
}

#[tauri::command]
fn torrent_get_stream_url(
    info_hash: &str,
    file_id: usize,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> String {
    manager.get_stream_url(info_hash, file_id)
}

#[tauri::command]
fn iptv_proxy_base_url(manager: tauri::State<'_, Arc<TorrentManager>>) -> String {
    manager.proxy_base_url()
}

#[tauri::command]
async fn iptv_resolve_stream(
    raw_url: String,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<animesh_core::domain::stream::ResolvedStream, CoreError> {
    trace_log(&format!("iptv_resolve_stream raw_url={raw_url}"));
    let resolved = manager.resolve_stream(&raw_url).await?;
    trace_log(&format!(
        "iptv_resolve_stream resolved kind={:?}",
        resolved.kind
    ));
    Ok(resolved)
}

#[tauri::command]
async fn torrent_get_files(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<Vec<FileDetails>, CoreError> {
    manager
        .get_torrent_files(info_hash)
        .await
        .ok_or(CoreError::TorrentNotFound)
}

#[tauri::command]
async fn torrent_get_video_metadata(
    info_hash: &str,
    file_id: usize,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<VideoMetadata, CoreError> {
    trace_log(&format!(
        "Entering torrent_get_video_metadata command, info_hash: {}, file_id: {}",
        info_hash, file_id
    ));
    manager.get_video_metadata(info_hash, file_id).await
}

#[tauri::command]
async fn torrent_get_subtitle_vtt(
    info_hash: &str,
    file_id: usize,
    track_id: u64,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<String, CoreError> {
    trace_log(&format!(
        "Entering torrent_get_subtitle_vtt command, info_hash: {}, file_id: {}, track_id: {}",
        info_hash, file_id, track_id
    ));
    manager.get_subtitle_vtt(info_hash, file_id, track_id).await
}

#[tauri::command]
async fn torrent_pause(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    manager.pause_torrent(info_hash).await
}

#[tauri::command]
async fn torrent_resume(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    manager.resume_torrent(info_hash).await
}

#[tauri::command]
async fn torrent_delete(
    info_hash: &str,
    delete_files: bool,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    manager.delete_torrent(info_hash, delete_files).await
}

#[tauri::command]
async fn torrent_list(
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<Vec<TorrentStatusInfo>, CoreError> {
    Ok(manager.list_torrents().await)
}

#[tauri::command]
async fn torrent_set_subject(
    info_hash: &str,
    subject_id: u64,
    subject_name: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    trace_log(&format!(
        "torrent_set_subject info_hash: {}, subject_id: {}, subject_name: {}",
        info_hash, subject_id, subject_name
    ));
    manager
        .set_subject_binding(info_hash, subject_id, subject_name.to_string())
        .await;
    Ok(())
}

#[tauri::command]
async fn torrent_clear_subject(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    trace_log(&format!("torrent_clear_subject info_hash: {}", info_hash));
    manager.clear_subject_binding(info_hash).await;
    Ok(())
}

#[tauri::command]
async fn collection_get_all(
    service: tauri::State<'_, Arc<CollectionService>>,
) -> Result<Vec<CollectionRecord>, CoreError> {
    service.list().await
}

#[tauri::command]
async fn collection_is_favorited(
    subject_id: i64,
    service: tauri::State<'_, Arc<CollectionService>>,
) -> Result<bool, CoreError> {
    service.is_favorited(subject_id).await
}

#[tauri::command]
async fn collection_add(
    subject_id: i64,
    name: String,
    image_url: Option<String>,
    service: tauri::State<'_, Arc<CollectionService>>,
) -> Result<(), CoreError> {
    service
        .add(animesh_core::domain::collection::NewCollectionItem {
            subject_id,
            name,
            image_url,
        })
        .await
}

#[tauri::command]
async fn collection_remove(
    subject_id: i64,
    service: tauri::State<'_, Arc<CollectionService>>,
) -> Result<(), CoreError> {
    service.remove(subject_id).await
}

#[tauri::command]
async fn torrent_subscribe(
    window: tauri::Window,
    subscription_id: String,
    session_id: String,
    on_event: tauri::ipc::Channel<Vec<TorrentStatusInfo>>,
    manager: tauri::State<'_, Arc<TorrentManager>>,
    tracker: tauri::State<'_, SubscriptionTracker>,
) -> Result<(), CoreError> {
    let window_label = window.label().to_string();

    let subs_clone = tracker.subscriptions.clone();
    if let Ok(mut subs) = tracker.subscriptions.lock() {
        // Find and remove any subscriptions that belong to the same window but a different session
        subs.retain(|_, (w_label, s_id)| !(w_label == &window_label && s_id != &session_id));

        // Insert the new subscription
        subs.insert(subscription_id.clone(), (window_label, session_id));
    }

    let manager = manager.inner().clone();
    tauri::async_runtime::spawn(async move {
        loop {
            // Check if subscription is still active
            {
                let active = if let Ok(subs) = subs_clone.lock() {
                    subs.contains_key(&subscription_id)
                } else {
                    false
                };
                if !active {
                    break;
                }
            }

            let torrents = manager.list_torrents().await;
            if on_event.send(torrents).is_err() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
        }
    });
    Ok(())
}

#[tauri::command]
fn torrent_unsubscribe(subscription_id: String, tracker: tauri::State<'_, SubscriptionTracker>) {
    if let Ok(mut subs) = tracker.subscriptions.lock() {
        subs.remove(&subscription_id);
    }
}

#[tauri::command]
fn settings_get(manager: tauri::State<'_, Arc<TorrentManager>>) -> Result<AppSettings, CoreError> {
    manager.get_settings()
}

#[tauri::command]
fn settings_set_download_dir(
    dir: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    manager.set_download_dir(dir.to_string())
}

#[tauri::command]
fn settings_set_proxy(
    proxy: Option<String>,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    manager.set_proxy(proxy)
}

#[tauri::command]
fn settings_set_ai_configs(
    configs: Option<Vec<AiConfig>>,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    manager.set_ai_configs(configs)
}

#[tauri::command]
async fn settings_set_max_download_speed(
    max_speed: Option<u32>,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    manager.set_max_download_speed(max_speed).await
}

#[tauri::command]
async fn settings_set_max_upload_speed(
    max_speed: Option<u32>,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    manager.set_max_upload_speed(max_speed).await
}

#[tauri::command]
async fn select_directory(app: tauri::AppHandle) -> Result<Option<String>, CoreError> {
    #[cfg(mobile)]
    {
        let _ = app;
        return Err(CoreError::Message(
            "Directory selection is not supported on mobile devices.".to_string(),
        ));
    }

    #[cfg(desktop)]
    {
        let path = tauri::async_runtime::spawn_blocking(move || {
            use tauri_plugin_dialog::DialogExt;
            app.dialog()
                .file()
                .blocking_pick_folder()
                .map(|file_path| match file_path {
                    tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
                    tauri_plugin_dialog::FilePath::Url(u) => {
                        if let Ok(p) = u.to_file_path() {
                            p.to_string_lossy().to_string()
                        } else {
                            u.to_string()
                        }
                    }
                })
        })
        .await
        .map_err(|e| CoreError::Message(e.to_string()))?;
        Ok(path)
    }
}

#[tauri::command]
async fn ai_chat_request(
    endpoint: String,
    api_key: String,
    body_json: String,
) -> Result<String, CoreError> {
    animesh_core::send_ai_chat_request(&endpoint, &api_key, &body_json).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::panic::set_hook(Box::new(|info| {
        let msg = match info.payload().downcast_ref::<&str>() {
            Some(s) => *s,
            None => match info.payload().downcast_ref::<String>() {
                Some(s) => &**s,
                None => "Box<dyn Any>",
            },
        };
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown location".to_string());
        let backtrace = std::backtrace::Backtrace::capture();
        log::error!(
            "Panic occurred at {}:\n{}\nBacktrace:\n{:?}",
            location,
            msg,
            backtrace
        );
    }));

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .filter(|metadata| {
                    let target = metadata.target();
                    !target.starts_with("librqbit") && !target.starts_with("tracing")
                })
                .build(),
        )
        .plugin(tauri_plugin_notification::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("animesh"));
            std::fs::create_dir_all(&app_data_dir).ok();

            let settings_path = app_data_dir.join("settings.json");

            // Read settings if exists, otherwise write defaults
            let mut download_dir = app_data_dir.join("downloads");
            let mut proxy = None;
            let mut max_download_speed = None;
            let mut max_upload_speed = None;
            if settings_path.exists() {
                if let Ok(file) = std::fs::File::open(&settings_path) {
                    if let Ok(settings) =
                        serde_json::from_reader::<_, AppSettings>(file)
                    {
                        download_dir = std::path::PathBuf::from(settings.download_dir);
                        proxy = settings.proxy;
                        max_download_speed = settings.max_download_speed;
                        max_upload_speed = settings.max_upload_speed;
                    }
                }
            } else {
                let settings = AppSettings {
                    download_dir: download_dir.to_string_lossy().to_string(),
                    proxy: None,
                    ai_configs: None,
                    max_download_speed: None,
                    max_upload_speed: None,
                };
                if let Ok(file) = std::fs::File::create(&settings_path) {
                    let _ = serde_json::to_writer_pretty(file, &settings);
                }
            }
            std::fs::create_dir_all(&download_dir).ok();

            let db = Arc::new(
                tauri::async_runtime::block_on(
                    animesh_core::infrastructure::db::AppDatabase::connect(
                        &app_data_dir.join("animesh.sqlite"),
                    ),
                )
                .context("初始化 AppDatabase 失败")?,
            );

            let manager = tauri::async_runtime::block_on(async {
                let download_dir_lock = Arc::new(RwLock::new(download_dir));
                let persistence_dir = settings_path
                    .parent()
                    .map(|p| p.join("torrents"))
                    .unwrap_or_else(|| std::path::PathBuf::from(".torrents"));
                let torrent_repo = animesh_core::infrastructure::rqbit_torrent::create_torrent_repository(
                    download_dir_lock.clone(),
                    persistence_dir,
                    &db,
                )
                .await
                .context("初始化 TorrentRepository 失败")?;

                let (port, hls_proxy) =
                    animesh_core::infrastructure::stream_server::start_stream_server(
                        torrent_repo.clone(),
                    )
                    .await
                    .context("初始化流媒体服务器失败")?;

                let crawler_repo =
                    animesh_core::infrastructure::http_crawler::create_crawler_repository();
                let subtitle_cache: Arc<dyn animesh_core::domain::subtitles::SubtitleCache> =
                    Arc::new(
                        animesh_core::infrastructure::subtitle_cache::InMemorySubtitleCache::new(),
                    );
                let subtitle_extractor: Arc<
                    dyn animesh_core::domain::subtitles::SubtitleExtractor,
                > = Arc::new(animesh_core::infrastructure::matroska_subtitles::MatroskaSubtitleExtractor);
                let stream_prober: Arc<
                    dyn animesh_core::domain::stream::StreamProber,
                > = Arc::new(hls_proxy);

                Ok::<TorrentManager, anyhow::Error>(TorrentManager::new(
                    download_dir_lock,
                    settings_path,
                    proxy,
                    max_download_speed,
                    max_upload_speed,
                    port,
                    torrent_repo,
                    crawler_repo,
                    subtitle_cache,
                    subtitle_extractor,
                    stream_prober,
                ))
            })
            .context("初始化 TorrentManager 失败")?;

            let collection_service = CollectionService::new(Arc::new(
                animesh_core::infrastructure::collection_repository::SqliteCollectionRepository::new(
                    &db,
                ),
            ));

            app.manage(Arc::new(manager));
            app.manage(Arc::new(collection_service));
            app.manage(SearchTracker::default());
            app.manage(AddMagnetTracker::default());
            app.manage(SubscriptionTracker::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search_torrents,
            cancel_search,
            torrent_add_magnet,
            cancel_add_magnet,
            torrent_get_status,
            torrent_get_stream_url,
            iptv_proxy_base_url,
            iptv_resolve_stream,
            torrent_get_files,
            torrent_pause,
            torrent_resume,
            torrent_delete,
            torrent_list,
            torrent_set_subject,
            torrent_clear_subject,
            collection_get_all,
            collection_is_favorited,
            collection_add,
            collection_remove,
            torrent_subscribe,
            torrent_unsubscribe,
            settings_get,
            settings_set_download_dir,
            settings_set_proxy,
            settings_set_ai_configs,
            settings_set_max_download_speed,
            settings_set_max_upload_speed,
            select_directory,
            torrent_get_video_metadata,
            torrent_get_subtitle_vtt,
            ai_chat_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
