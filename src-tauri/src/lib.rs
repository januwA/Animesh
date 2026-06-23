// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, search_dmhy])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
