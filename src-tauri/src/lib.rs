// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use animesh_core::torrent::{AddTorrentResult, TorrentManager, TorrentStatusInfo};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("animesh"));
            let download_dir = app_data_dir.join("downloads");
            std::fs::create_dir_all(&download_dir).ok();

            let manager = tauri::async_runtime::block_on(async {
                TorrentManager::new(download_dir)
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
            torrent_get_stream_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
