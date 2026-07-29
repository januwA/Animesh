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
    data: T,
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
        let current_mtime = std::fs::metadata(file_path).ok()?.modified().ok()?;
        if current_mtime == entry.mtime {
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
        if let Ok(mtime) = std::fs::metadata(file_path).and_then(|m| m.modified()) {
            let key = format!("{}:{}", info_hash, file_id);
            if let Ok(mut cache) = self.tracks.write() {
                cache.insert(key, CachedEntry { mtime, data });
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
        let current_mtime = std::fs::metadata(file_path).ok()?.modified().ok()?;
        if current_mtime == entry.mtime {
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
        if let Ok(mtime) = std::fs::metadata(file_path).and_then(|m| m.modified()) {
            let key = format!("{}:{}:{}", info_hash, file_id, track_id);
            if let Ok(mut cache) = self.vtt.write() {
                cache.insert(key, CachedEntry { mtime, data });
            }
        }
    }
}
