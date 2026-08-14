use crate::domain::subtitles::SubtitleCache;
use async_trait::async_trait;
use std::collections::HashMap;
use std::path::Path;
use std::sync::RwLock;
use std::time::{Duration, SystemTime};

/// 解析失败后的冷却时长。文件未下载完整时解析必然失败，
/// 冷却期内直接复用缓存错误，避免每次重试都重新读取整个 MKV。
const FAILURE_COOLDOWN: Duration = Duration::from_secs(30);

#[derive(Default)]
pub struct InMemorySubtitleCache {
    vtt: RwLock<HashMap<String, CachedEntry<String>>>,
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

async fn file_fingerprint(path: &Path) -> Option<(SystemTime, u64)> {
    let meta = tokio::fs::metadata(path).await.ok()?;
    Some((meta.modified().ok()?, meta.len()))
}

impl InMemorySubtitleCache {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl SubtitleCache for InMemorySubtitleCache {
    async fn get_vtt(
        &self,
        info_hash: &str,
        file_id: usize,
        track_id: u64,
        file_path: &Path,
    ) -> Option<String> {
        let key = format!("{}:{}:{}", info_hash, file_id, track_id);
        let (mtime, len, data) = {
            let cache = self.vtt.read().ok()?;
            let entry = cache.get(&key)?;
            (entry.mtime, entry.len, entry.data.clone())
        };
        if file_fingerprint(file_path).await == Some((mtime, len)) {
            Some(data)
        } else {
            None
        }
    }

    async fn set_vtt(
        &self,
        info_hash: &str,
        file_id: usize,
        track_id: u64,
        file_path: &Path,
        data: String,
    ) {
        if let Some((mtime, len)) = file_fingerprint(file_path).await {
            let key = format!("{}:{}:{}", info_hash, file_id, track_id);
            if let Ok(mut cache) = self.vtt.write() {
                cache.insert(key, CachedEntry { mtime, len, data });
            }
        }
    }

    /// 记录一次解析失败。仅当文件指纹有效时记录，方便冷却失效判断。
    async fn set_failure(
        &self,
        key: &str,
        file_path: &Path,
        error: String,
        now: Option<SystemTime>,
    ) {
        let Some((mtime, len)) = file_fingerprint(file_path).await else {
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
    async fn get_failure(
        &self,
        key: &str,
        file_path: &Path,
        now: Option<SystemTime>,
    ) -> Option<String> {
        let (mtime, len, error, expire_at) = {
            let cache = self.failures.read().ok()?;
            let entry = cache.get(key)?;
            (entry.mtime, entry.len, entry.error.clone(), entry.expire_at)
        };
        let now = now.unwrap_or_else(SystemTime::now);
        if now < expire_at && file_fingerprint(file_path).await == Some((mtime, len)) {
            Some(error)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_文件长度变化后VTT缓存应失效() {
        let cache = InMemorySubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_test_len.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"12345")
            .unwrap();

        cache
            .set_vtt("hash", 0, 1, &temp_path, "v1".to_string())
            .await;
        assert_eq!(
            cache.get_vtt("hash", 0, 1, &temp_path).await,
            Some("v1".to_string())
        );

        // 文件增长 → len 变化 → 缓存失效
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"123456789")
            .unwrap();
        assert_eq!(cache.get_vtt("hash", 0, 1, &temp_path).await, None);

        let _ = std::fs::remove_file(&temp_path);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_冷却期内命中失败缓存() {
        let cache = InMemorySubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_failure_hit.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"incomplete")
            .unwrap();

        let now = std::time::SystemTime::now();
        cache
            .set_failure(
                "hash:0:1",
                &temp_path,
                "Failed to parse MKV: CantFindCluster".to_string(),
                Some(now),
            )
            .await;
        assert_eq!(
            cache.get_failure("hash:0:1", &temp_path, Some(now)).await,
            Some("Failed to parse MKV: CantFindCluster".to_string())
        );

        let _ = std::fs::remove_file(&temp_path);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_冷却过期后允许重新解析() {
        let cache = InMemorySubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_failure_expired.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"incomplete")
            .unwrap();

        let now = std::time::SystemTime::now();
        cache
            .set_failure("hash:0:1", &temp_path, "boom".to_string(), Some(now))
            .await;
        let expired = now + FAILURE_COOLDOWN + std::time::Duration::from_secs(1);
        assert_eq!(
            cache
                .get_failure("hash:0:1", &temp_path, Some(expired))
                .await,
            None
        );

        let _ = std::fs::remove_file(&temp_path);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_文件指纹变化后冷却失效() {
        let cache = InMemorySubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_failure_changed.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"incomplete")
            .unwrap();

        let now = std::time::SystemTime::now();
        cache
            .set_failure("hash:0:1", &temp_path, "boom".to_string(), Some(now))
            .await;

        // 文件增长 → len 变化 → 冷却失效，允许重新解析
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"incomplete-more-data")
            .unwrap();
        assert_eq!(
            cache.get_failure("hash:0:1", &temp_path, Some(now)).await,
            None
        );

        let _ = std::fs::remove_file(&temp_path);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_冷却key不同互不影响() {
        let cache = InMemorySubtitleCache::new();
        let temp_path = std::env::temp_dir().join("subtitle_cache_failure_key.mkv");
        std::fs::File::create(&temp_path)
            .unwrap()
            .write_all(b"incomplete")
            .unwrap();

        let now = std::time::SystemTime::now();
        cache
            .set_failure("hash:0:1", &temp_path, "boom".to_string(), Some(now))
            .await;
        assert_eq!(
            cache.get_failure("hash:0:2", &temp_path, Some(now)).await,
            None
        );

        let _ = std::fs::remove_file(&temp_path);
    }
}
