// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use animesh_core::torrent::{AddTorrentResult, TorrentStatusInfo};
use animesh_core::torrent_manager::TorrentManager;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
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
) -> Result<Vec<animesh_core::crawler::SearchResultItem>, String> {
    trace_log(&format!(
        "Entering search_torrents command, trace_id: {}, keyword: {}, engine: {}",
        trace_id, keyword, engine
    ));

    let manager_clone = manager.inner().clone();
    let keyword_string = keyword.to_string();
    let engine_string = engine.to_string();

    let task = tokio::spawn(async move {
        let proxy = manager_clone.get_proxy();
        match engine_string.as_str() {
            "dmhy" => {
                manager_clone
                    .crawler_repo
                    .search_dmhy(&keyword_string, proxy)
                    .await
            }
            "bangumi_moe" => {
                manager_clone
                    .crawler_repo
                    .search_bangumi_moe(&keyword_string, proxy)
                    .await
            }
            "mikan" => {
                manager_clone
                    .crawler_repo
                    .search_mikan(&keyword_string, proxy)
                    .await
            }
            "nyaa" => {
                manager_clone
                    .crawler_repo
                    .search_nyaa(&keyword_string, proxy)
                    .await
            }
            _ => Err(format!("Unsupported search engine: {}", engine_string)),
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
                Err("Search cancelled".to_string())
            } else {
                trace_log(&format!("search_torrents task panicked: {:?}", join_err));
                Err("Search task panicked".to_string())
            }
        }
    }
}

#[tauri::command]
async fn torrent_add_magnet(
    magnet: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<AddTorrentResult, String> {
    trace_log(&format!(
        "Entering torrent_add_magnet command, magnet length: {}",
        magnet.len()
    ));
    let clean_magnet = if magnet.len() > 60 {
        format!("{}...{}", &magnet[0..40], &magnet[magnet.len() - 20..])
    } else {
        magnet.to_string()
    };
    trace_log(&format!("Processed magnet string: {}", clean_magnet));

    let res = manager.add_magnet(magnet).await.map_err(|e| e.to_string());
    match &res {
        Ok(t) => trace_log(&format!(
            "torrent_add_magnet succeeded, info_hash: {}, files count: {}",
            t.info_hash,
            t.files.len()
        )),
        Err(e) => trace_log(&format!("torrent_add_magnet failed with error: {}", e)),
    }
    res
}

#[tauri::command]
fn torrent_get_status(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<TorrentStatusInfo, String> {
    manager
        .get_torrent_status(info_hash)
        .ok_or_else(|| "Torrent not found".to_string())
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
fn torrent_get_files(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<Vec<animesh_core::torrent::FileDetails>, String> {
    manager
        .get_torrent_files(info_hash)
        .ok_or_else(|| "Torrent not found".to_string())
}

#[tauri::command]
async fn torrent_get_subtitle_tracks(
    info_hash: &str,
    file_id: usize,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<Vec<animesh_core::subtitles::SubtitleTrackInfo>, String> {
    trace_log(&format!(
        "Entering torrent_get_subtitle_tracks command, info_hash: {}, file_id: {}",
        info_hash, file_id
    ));
    let files = manager
        .get_torrent_files(info_hash)
        .ok_or_else(|| "Torrent not found".to_string())?;
    let file_details = files
        .iter()
        .find(|f| f.id == file_id)
        .ok_or_else(|| "File not found".to_string())?;

    let name_lower = file_details.name.to_lowercase();
    if !name_lower.ends_with(".mkv") {
        return Ok(Vec::new());
    }

    let stream = manager
        .torrent_repo
        .get_file_reader(info_hash, file_id)
        .map_err(|e| format!("Failed to open torrent stream: {}", e))?;
    let sync_reader = animesh_core::subtitles::SyncReader::new(stream);
    let buffered_reader = std::io::BufReader::new(sync_reader);

    match tokio::task::spawn_blocking(move || {
        animesh_core::subtitles::extract_subtitle_tracks_from_reader(buffered_reader)
    })
    .await
    {
        Ok(Ok(tracks)) => Ok(tracks),
        Ok(Err(e)) => Err(format!(
            "Failed to extract tracks (possibly file is incomplete): {}",
            e
        )),
        Err(e) => Err(format!("Task spawn error: {}", e)),
    }
}

#[tauri::command]
async fn torrent_get_subtitle_vtt(
    info_hash: &str,
    file_id: usize,
    track_id: u64,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<String, String> {
    trace_log(&format!(
        "Entering torrent_get_subtitle_vtt command, info_hash: {}, file_id: {}, track_id: {}",
        info_hash, file_id, track_id
    ));
    let download_dir = manager.get_download_dir();
    let files = manager
        .get_torrent_files(info_hash)
        .ok_or_else(|| "Torrent not found".to_string())?;
    let file_details = files
        .iter()
        .find(|f| f.id == file_id)
        .ok_or_else(|| "File not found".to_string())?;

    let path = std::path::PathBuf::from(download_dir).join(&file_details.name);
    if !path.exists() {
        return Err("Video file not downloaded or doesn't exist yet".to_string());
    }

    match tokio::task::spawn_blocking(move || {
        animesh_core::subtitles::extract_subtitle_vtt(&path, track_id)
    })
    .await
    {
        Ok(result) => result,
        Err(e) => Err(format!("Task spawn error: {}", e)),
    }
}

#[tauri::command]
async fn torrent_pause(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), String> {
    manager
        .pause_torrent(info_hash)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn torrent_resume(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), String> {
    manager
        .resume_torrent(info_hash)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn torrent_delete(
    info_hash: &str,
    delete_files: bool,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), String> {
    manager
        .delete_torrent(info_hash, delete_files)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn torrent_list(
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<Vec<TorrentStatusInfo>, String> {
    Ok(manager.list_torrents())
}

#[tauri::command]
async fn torrent_subscribe(
    window: tauri::Window,
    subscription_id: String,
    session_id: String,
    on_event: tauri::ipc::Channel<Vec<TorrentStatusInfo>>,
    manager: tauri::State<'_, Arc<TorrentManager>>,
    tracker: tauri::State<'_, SubscriptionTracker>,
) -> Result<(), String> {
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

            let torrents = manager.list_torrents();
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
fn settings_get(
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<animesh_core::torrent_manager::AppSettings, String> {
    Ok(animesh_core::torrent_manager::AppSettings {
        download_dir: manager.get_download_dir(),
        proxy: manager.get_proxy(),
        trackers: Some(manager.get_trackers()),
    })
}

#[tauri::command]
fn settings_set_download_dir(
    dir: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), String> {
    manager
        .set_download_dir(dir.to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn settings_set_proxy(
    proxy: Option<String>,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), String> {
    manager.set_proxy(proxy).map_err(|e| e.to_string())
}

#[tauri::command]
fn settings_set_trackers(
    trackers: Vec<String>,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), String> {
    manager.set_trackers(trackers).map_err(|e| e.to_string())
}

#[tauri::command]
async fn select_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    #[cfg(mobile)]
    {
        let _ = app;
        return Err("Directory selection is not supported on mobile devices.".to_string());
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
        .map_err(|e| e.to_string())?;
        Ok(path)
    }
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
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build());

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
            if settings_path.exists() {
                if let Ok(file) = std::fs::File::open(&settings_path) {
                    if let Ok(settings) = serde_json::from_reader::<
                        _,
                        animesh_core::torrent_manager::AppSettings,
                    >(file)
                    {
                        download_dir = std::path::PathBuf::from(settings.download_dir);
                        proxy = settings.proxy;
                    }
                }
            } else {
                let settings = animesh_core::torrent_manager::AppSettings {
                    download_dir: download_dir.to_string_lossy().to_string(),
                    proxy: None,
                    trackers: Some(animesh_core::torrent_manager::get_default_trackers()),
                };
                if let Ok(file) = std::fs::File::create(&settings_path) {
                    let _ = serde_json::to_writer_pretty(file, &settings);
                }
            }
            std::fs::create_dir_all(&download_dir).ok();

            let manager = tauri::async_runtime::block_on(async {
                TorrentManager::new(download_dir, settings_path, proxy)
                    .await
                    .expect("Failed to initialize TorrentManager")
            });

            app.manage(Arc::new(manager));
            app.manage(SearchTracker::default());
            app.manage(SubscriptionTracker::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search_torrents,
            cancel_search,
            torrent_add_magnet,
            torrent_get_status,
            torrent_get_stream_url,
            torrent_get_files,
            torrent_pause,
            torrent_resume,
            torrent_delete,
            torrent_list,
            torrent_subscribe,
            torrent_unsubscribe,
            settings_get,
            settings_set_download_dir,
            settings_set_proxy,
            settings_set_trackers,
            select_directory,
            torrent_get_subtitle_tracks,
            torrent_get_subtitle_vtt
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
