fn main() {
    let profile = std::env::var("PROFILE").unwrap_or_default();
    if profile != "test" {
        tauri_build::build();
    }
}
