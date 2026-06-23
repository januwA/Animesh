pub mod crawler;
pub mod torrent;
pub mod torrent_manager;

pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        assert_eq!(
            greet("World"),
            "Hello, World! You've been greeted from Rust!"
        );
    }
}
