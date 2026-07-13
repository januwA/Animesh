pub mod crawler;
pub mod domain;
pub mod infrastructure;
pub mod subtitles;
pub mod torrent;
pub mod torrent_manager;

pub use infrastructure::http_client::send_ai_chat_request;
