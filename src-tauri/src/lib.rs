// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use animesh_core::torrent::{AddTorrentResult, TorrentStatusInfo};
use animesh_core::torrent_manager::TorrentManager;
use std::sync::Arc;
use tauri::Manager;

pub fn trace_log(msg: &str) {
    log::info!("[TRACE] {}", msg);
}

#[tauri::command]
async fn search_dmhy(
    keyword: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<Vec<animesh_core::crawler::SearchResultItem>, String> {
    let proxy = manager.get_proxy();
    manager.crawler_repo.search_dmhy(keyword, proxy).await
}

#[tauri::command]
async fn search_torrents(
    keyword: &str,
    engine: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<Vec<animesh_core::crawler::SearchResultItem>, String> {
    trace_log(&format!(
        "Entering search_torrents command, keyword: {}, engine: {}",
        keyword, engine
    ));
    let proxy = manager.get_proxy();
    let res = match engine {
        "dmhy" => manager.crawler_repo.search_dmhy(keyword, proxy).await,
        "bangumi_moe" => {
            manager
                .crawler_repo
                .search_bangumi_moe(keyword, proxy)
                .await
        }
        "mikan" => manager.crawler_repo.search_mikan(keyword, proxy).await,
        "nyaa" => manager.crawler_repo.search_nyaa(keyword, proxy).await,
        _ => Err(format!("Unsupported search engine: {}", engine)),
    };
    match &res {
        Ok(items) => trace_log(&format!(
            "search_torrents completed successfully, found {} items",
            items.len()
        )),
        Err(e) => trace_log(&format!("search_torrents failed with error: {}", e)),
    }
    res
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
        Ok(Err(e)) => {
            println!(
                "[Subtitle] Failed to extract tracks (possibly file is incomplete): {}",
                e
            );
            Ok(Vec::new())
        }
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
    let path = tauri::async_runtime::spawn_blocking(move || {
        use tauri_plugin_dialog::DialogExt;
        app.dialog()
            .file()
            .blocking_pick_folder()
            .and_then(|file_path| match file_path {
                tauri_plugin_dialog::FilePath::Path(p) => Some(p.to_string_lossy().to_string()),
                tauri_plugin_dialog::FilePath::Url(u) => {
                    if let Ok(p) = u.to_file_path() {
                        Some(p.to_string_lossy().to_string())
                    } else {
                        Some(u.to_string())
                    }
                }
            })
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(path)
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

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .filter(|metadata| {
                    let target = metadata.target();
                    !target.starts_with("librqbit") && !target.starts_with("tracing")
                })
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search_dmhy,
            search_torrents,
            torrent_add_magnet,
            torrent_get_status,
            torrent_get_stream_url,
            torrent_get_files,
            torrent_pause,
            torrent_resume,
            torrent_delete,
            torrent_list,
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
