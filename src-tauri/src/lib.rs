// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use animesh_core::torrent::{AddTorrentResult, TorrentStatusInfo};
use animesh_core::torrent_manager::TorrentManager;
use std::sync::Arc;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    animesh_core::greet(name)
}

#[tauri::command]
async fn search_dmhy(
    keyword: &str,
) -> Result<Vec<animesh_core::crawler::SearchResultItem>, String> {
    animesh_core::crawler::search_dmhy(keyword).await
}

#[tauri::command]
async fn torrent_add_magnet(
    magnet: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<AddTorrentResult, String> {
    manager.add_magnet(magnet).await.map_err(|e| e.to_string())
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
fn torrent_get_subtitle_tracks(
    info_hash: &str,
    file_id: usize,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<Vec<animesh_core::subtitles::SubtitleTrackInfo>, String> {
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

    animesh_core::subtitles::extract_subtitle_tracks(&path)
}

#[tauri::command]
fn torrent_get_subtitle_vtt(
    info_hash: &str,
    file_id: usize,
    track_id: u64,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<String, String> {
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

    animesh_core::subtitles::extract_subtitle_vtt(&path, track_id)
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
async fn select_directory() -> Result<Option<String>, String> {
    let path = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .pick_folder()
            .map(|p| p.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            if settings_path.exists() {
                if let Ok(file) = std::fs::File::open(&settings_path) {
                    if let Ok(settings) = serde_json::from_reader::<
                        _,
                        animesh_core::torrent_manager::AppSettings,
                    >(file)
                    {
                        download_dir = std::path::PathBuf::from(settings.download_dir);
                    }
                }
            } else {
                let settings = animesh_core::torrent_manager::AppSettings {
                    download_dir: download_dir.to_string_lossy().to_string(),
                };
                if let Ok(file) = std::fs::File::create(&settings_path) {
                    let _ = serde_json::to_writer_pretty(file, &settings);
                }
            }
            std::fs::create_dir_all(&download_dir).ok();

            let manager = tauri::async_runtime::block_on(async {
                TorrentManager::new(download_dir, settings_path)
                    .await
                    .expect("Failed to initialize TorrentManager")
            });

            app.manage(Arc::new(manager));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            search_dmhy,
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
            select_directory,
            torrent_get_subtitle_tracks,
            torrent_get_subtitle_vtt
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
