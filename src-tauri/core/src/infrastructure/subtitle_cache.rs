use crate::domain::subtitles::SubtitleTrackInfo;
use std::collections::HashMap;
use std::path::Path;
use std::sync::RwLock;
use std::time::SystemTime;

#[derive(Default)]
pub struct SubtitleCache {
    tracks: RwLock<HashMap<String, CachedEntry<Vec<SubtitleTrackInfo>>>>,
    vtt: RwLock<HashMap<String, CachedEntry<String>>>,
}

struct CachedEntry<T> {
    mtime: SystemTime,
    len: u64,
    data: T,
}

fn file_fingerprint(path: &Path) -> Option<(SystemTime, u64)> {
    let meta = std::fs::metadata(path).ok()?;
    Some((meta.modified().ok()?, meta.len()))
}

impl SubtitleCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get_tracks(
        &self,
        info_hash: &str,
        file_id: usize,
        file_path: &Path,
    ) -> Option<Vec<SubtitleTrackInfo>> {
        let key = format!("{}:{}", info_hash, file_id);
        let cache = self.tracks.read().ok()?;
        let entry = cache.get(&key)?;
        if file_fingerprint(file_path) == Some((entry.mtime, entry.len)) {
            Some(entry.data.clone())
        } else {
            None
        }
    }

    pub fn set_tracks(
        &self,
        info_hash: &str,
        file_id: usize,
        file_path: &Path,
        data: Vec<SubtitleTrackInfo>,
    ) {
        if let Some((mtime, len)) = file_fingerprint(file_path) {
            let key = format!("{}:{}", info_hash, file_id);
            if let Ok(mut cache) = self.tracks.write() {
                cache.insert(key, CachedEntry { mtime, len, data });
            }
        }
    }

    pub fn get_vtt(
        &self,
        info_hash: &str,
        file_id: usize,
        track_id: u64,
        file_path: &Path,
    ) -> Option<String> {
        let key = format!("{}:{}:{}", info_hash, file_id, track_id);
        let cache = self.vtt.read().ok()?;
        let entry = cache.get(&key)?;
        if file_fingerprint(file_path) == Some((entry.mtime, entry.len)) {
            Some(entry.data.clone())
        } else {
            None
        }
    }

    pub fn set_vtt(
        &self,
        info_hash: &str,
        file_id: usize,
        track_id: u64,
        file_path: &Path,
        data: String,
    ) {
        if let Some((mtime, len)) = file_fingerprint(file_path) {
            let key = format!("{}:{}:{}", info_hash, file_id, track_id);
            if let Ok(mut cache) = self.vtt.write() {
                cache.insert(key, CachedEntry { mtime, len, data });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    #[allow(non_snake_case)]
    fn 测试_文件长度变化后缓存应失效() {
        let cache = SubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_test_len.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"12345")
            .unwrap();

        cache.set_vtt("hash", 0, 1, &temp_path, "v1".to_string());
        assert_eq!(
            cache.get_vtt("hash", 0, 1, &temp_path),
            Some("v1".to_string())
        );

        // 文件增长 → len 变化 → 缓存失效
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"123456789")
            .unwrap();
        assert_eq!(cache.get_vtt("hash", 0, 1, &temp_path), None);

        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_字幕轨道缓存文件长度变化后应失效() {
        let cache = SubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_test_tracks_len.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"12345")
            .unwrap();

        let tracks = vec![SubtitleTrackInfo {
            id: 1,
            language: "eng".to_string(),
            title: "English".to_string(),
            codec: "S_TEXT/UTF8".to_string(),
        }];
        cache.set_tracks("hash", 0, &temp_path, tracks.clone());
        assert_eq!(cache.get_tracks("hash", 0, &temp_path), Some(tracks));

        // 文件增长 → len 变化 → 缓存失效
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"123456789")
            .unwrap();
        assert_eq!(cache.get_tracks("hash", 0, &temp_path), None);

        let _ = std::fs::remove_file(&temp_path);
    }
}
