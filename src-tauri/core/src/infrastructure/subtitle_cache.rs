use crate::domain::subtitles::{ChapterInfo, SubtitleTrackInfo, VideoInfo};
use std::collections::HashMap;
use std::path::Path;
use std::sync::RwLock;
use std::time::{Duration, SystemTime};

/// 解析失败后的冷却时长。文件未下载完整时解析必然失败，
/// 冷却期内直接复用缓存错误，避免每次重试都重新读取整个 MKV。
const FAILURE_COOLDOWN: Duration = Duration::from_secs(30);

#[derive(Default)]
pub struct SubtitleCache {
    tracks: RwLock<HashMap<String, CachedEntry<Vec<SubtitleTrackInfo>>>>,
    vtt: RwLock<HashMap<String, CachedEntry<String>>>,
    chapters: RwLock<HashMap<String, CachedEntry<Vec<ChapterInfo>>>>,
    info: RwLock<HashMap<String, CachedEntry<VideoInfo>>>,
    failures: RwLock<HashMap<String, CachedFailure>>,
}

struct CachedEntry<T> {
    mtime: SystemTime,
    len: u64,
    data: T,
}

struct CachedFailure {
    mtime: SystemTime,
    len: u64,
    error: String,
    expire_at: SystemTime,
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

    pub fn get_chapters(
        &self,
        info_hash: &str,
        file_id: usize,
        file_path: &Path,
    ) -> Option<Vec<ChapterInfo>> {
        let key = format!("{}:{}", info_hash, file_id);
        let cache = self.chapters.read().ok()?;
        let entry = cache.get(&key)?;
        if file_fingerprint(file_path) == Some((entry.mtime, entry.len)) {
            Some(entry.data.clone())
        } else {
            None
        }
    }

    pub fn set_chapters(
        &self,
        info_hash: &str,
        file_id: usize,
        file_path: &Path,
        data: Vec<ChapterInfo>,
    ) {
        if let Some((mtime, len)) = file_fingerprint(file_path) {
            let key = format!("{}:{}", info_hash, file_id);
            if let Ok(mut cache) = self.chapters.write() {
                cache.insert(key, CachedEntry { mtime, len, data });
            }
        }
    }

    pub fn get_video_info(
        &self,
        info_hash: &str,
        file_id: usize,
        file_path: &Path,
    ) -> Option<VideoInfo> {
        let key = format!("{}:{}", info_hash, file_id);
        let cache = self.info.read().ok()?;
        let entry = cache.get(&key)?;
        if file_fingerprint(file_path) == Some((entry.mtime, entry.len)) {
            Some(entry.data.clone())
        } else {
            None
        }
    }

    pub fn set_video_info(
        &self,
        info_hash: &str,
        file_id: usize,
        file_path: &Path,
        data: VideoInfo,
    ) {
        if let Some((mtime, len)) = file_fingerprint(file_path) {
            let key = format!("{}:{}", info_hash, file_id);
            if let Ok(mut cache) = self.info.write() {
                cache.insert(key, CachedEntry { mtime, len, data });
            }
        }
    }

    /// 记录一次解析失败。仅当文件指纹有效时记录，方便冷却失效判断。
    pub fn set_failure(&self, key: &str, file_path: &Path, error: String, now: Option<SystemTime>) {
        let Some((mtime, len)) = file_fingerprint(file_path) else {
            return;
        };
        let expire_at = now.unwrap_or_else(SystemTime::now) + FAILURE_COOLDOWN;
        if let Ok(mut cache) = self.failures.write() {
            cache.insert(
                key.to_string(),
                CachedFailure {
                    mtime,
                    len,
                    error,
                    expire_at,
                },
            );
        }
    }

    /// 命中冷却期内的失败缓存时返回错误信息。
    /// 若文件指纹已变化（下载有进展）或已过期，返回 None 允许重新解析。
    pub fn get_failure(
        &self,
        key: &str,
        file_path: &Path,
        now: Option<SystemTime>,
    ) -> Option<String> {
        let cache = self.failures.read().ok()?;
        let entry = cache.get(key)?;
        let now = now.unwrap_or_else(SystemTime::now);
        if now < entry.expire_at && file_fingerprint(file_path) == Some((entry.mtime, entry.len)) {
            Some(entry.error.clone())
        } else {
            None
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

    #[test]
    #[allow(non_snake_case)]
    fn 测试_媒体信息缓存文件长度变化后应失效() {
        let cache = SubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_test_info_len.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"12345")
            .unwrap();

        let info = VideoInfo {
            date_utc: Some(978_307_200),
            muxing_app: "mkvmerge".to_string(),
            writing_app: "libebml".to_string(),
            video_tracks: vec![],
            audio_tracks: vec![],
        };
        cache.set_video_info("hash", 0, &temp_path, info.clone());
        assert_eq!(cache.get_video_info("hash", 0, &temp_path), Some(info));

        // 文件增长 → len 变化 → 缓存失效
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"123456789")
            .unwrap();
        assert_eq!(cache.get_video_info("hash", 0, &temp_path), None);

        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_冷却期内命中失败缓存() {
        let cache = SubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_failure_hit.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"incomplete")
            .unwrap();

        let now = std::time::SystemTime::now();
        cache.set_failure(
            "hash:0",
            &temp_path,
            "Failed to parse MKV: CantFindCluster".to_string(),
            Some(now),
        );
        assert_eq!(
            cache.get_failure("hash:0", &temp_path, Some(now)),
            Some("Failed to parse MKV: CantFindCluster".to_string())
        );

        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_冷却过期后允许重新解析() {
        let cache = SubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_failure_expired.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"incomplete")
            .unwrap();

        let now = std::time::SystemTime::now();
        cache.set_failure("hash:0", &temp_path, "boom".to_string(), Some(now));
        let expired = now + FAILURE_COOLDOWN + std::time::Duration::from_secs(1);
        assert_eq!(cache.get_failure("hash:0", &temp_path, Some(expired)), None);

        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_文件指纹变化后冷却失效() {
        let cache = SubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_failure_changed.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"incomplete")
            .unwrap();

        let now = std::time::SystemTime::now();
        cache.set_failure("hash:0", &temp_path, "boom".to_string(), Some(now));

        // 文件增长 → len 变化 → 冷却失效，允许重新解析
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"incomplete-more-data")
            .unwrap();
        assert_eq!(cache.get_failure("hash:0", &temp_path, Some(now)), None);

        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_冷却key不同互不影响() {
        let cache = SubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_failure_key.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"incomplete")
            .unwrap();

        let now = std::time::SystemTime::now();
        cache.set_failure("hash:0", &temp_path, "boom".to_string(), Some(now));
        assert_eq!(cache.get_failure("hash:1", &temp_path, Some(now)), None);

        let _ = std::fs::remove_file(&temp_path);
    }
}
