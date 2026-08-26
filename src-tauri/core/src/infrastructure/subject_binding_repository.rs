use crate::domain::torrent::{SubjectBinding, SubjectBindingRepository};
use crate::infrastructure::db::AppDatabase;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::RwLock;

/// 下载资源与条目的绑定关系仓储，按 (info_hash, platform) 唯一标识。
/// 启动时从 SQLite 加载到内存作为读缓存，写入时直写内存与数据库（失败回滚内存）。
pub struct SqliteSubjectBindingRepository {
    bindings: RwLock<HashMap<(String, String), SubjectBinding>>,
    pool: sqlx::SqlitePool,
}

/// 内存缓存键：`info_hash:platform`
fn cache_key(info_hash: &str, platform: &str) -> (String, String) {
    (info_hash.to_lowercase(), platform.to_string())
}

impl SqliteSubjectBindingRepository {
    pub async fn new(db: &AppDatabase) -> Self {
        let pool = db.pool().clone();
        let rows = sqlx::query_as::<_, (String, String, i64, String)>(
            "SELECT info_hash, platform, subject_id, subject_name FROM torrent_subject_bindings",
        )
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
        let mut bindings = HashMap::with_capacity(rows.len());
        for (hash, platform, subject_id, subject_name) in rows {
            bindings.insert(
                cache_key(&hash, &platform),
                SubjectBinding {
                    subject_id: subject_id as u64,
                    platform,
                    subject_name,
                },
            );
        }
        Self {
            bindings: RwLock::new(bindings),
            pool,
        }
    }
}

#[async_trait]
impl SubjectBindingRepository for SqliteSubjectBindingRepository {
    async fn get(&self, info_hash: &str, platform: &str) -> Option<SubjectBinding> {
        self.bindings
            .read()
            .unwrap()
            .get(&cache_key(info_hash, platform))
            .cloned()
    }

    async fn set(&self, info_hash: &str, binding: SubjectBinding) {
        let key = cache_key(info_hash, &binding.platform);
        {
            let mut bindings = self.bindings.write().unwrap();
            bindings.insert(key.clone(), binding.clone());
        }
        let result = sqlx::query(
            "INSERT INTO torrent_subject_bindings (info_hash, platform, subject_id, subject_name) VALUES (?, ?, ?, ?)
             ON CONFLICT(info_hash, platform) DO UPDATE SET subject_id = excluded.subject_id, subject_name = excluded.subject_name",
        )
        .bind(&key.0)
        .bind(&binding.platform)
        .bind(binding.subject_id as i64)
        .bind(&binding.subject_name)
        .execute(&self.pool)
        .await;
        if result.is_err() {
            self.bindings.write().unwrap().remove(&key);
        }
    }

    async fn clear(&self, info_hash: &str, platform: &str) {
        let key = cache_key(info_hash, platform);
        let removed = self.bindings.write().unwrap().remove(&key);
        let result = sqlx::query(
            "DELETE FROM torrent_subject_bindings WHERE info_hash = ? AND platform = ?",
        )
        .bind(&key.0)
        .bind(platform)
        .execute(&self.pool)
        .await;
        if result.is_err() {
            if let Some(binding) = removed {
                self.bindings.write().unwrap().insert(key, binding);
            }
        }
    }

    async fn clear_all(&self, info_hash: &str) {
        let hash_lower = info_hash.to_lowercase();
        let keys: Vec<(String, String)> = {
            let bindings = self.bindings.read().unwrap();
            bindings
                .keys()
                .filter(|(h, _)| h == &hash_lower)
                .cloned()
                .collect()
        };
        let mut removed = Vec::new();
        for key in &keys {
            if let Some(binding) = self.bindings.write().unwrap().remove(key) {
                removed.push((key.clone(), binding));
            }
        }
        let result = sqlx::query("DELETE FROM torrent_subject_bindings WHERE info_hash = ?")
            .bind(&hash_lower)
            .execute(&self.pool)
            .await;
        if result.is_err() {
            let mut bindings = self.bindings.write().unwrap();
            for (key, binding) in removed {
                bindings.insert(key, binding);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn setup_store() -> SqliteSubjectBindingRepository {
        let db = AppDatabase::connect_in_memory()
            .await
            .expect("内存库应成功");
        SqliteSubjectBindingRepository::new(&db).await
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_绑定存储_设置读取与清除() {
        let store = setup_store().await;

        let hash = "ABC123";
        assert_eq!(store.get(hash, "bangumi").await, None);

        store
            .set(
                hash,
                SubjectBinding {
                    subject_id: 42,
                    platform: "bangumi".to_string(),
                    subject_name: "测试条目".to_string(),
                },
            )
            .await;

        // 大小写不敏感查找
        let binding = store.get("abc123", "bangumi").await.expect("应能查到绑定");
        assert_eq!(binding.subject_id, 42);
        assert_eq!(binding.subject_name, "测试条目");

        store.clear(hash, "bangumi").await;
        assert_eq!(store.get(hash, "bangumi").await, None);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_绑定存储_不同平台同hash可分别绑定() {
        let store = setup_store().await;

        store
            .set(
                "hash1",
                SubjectBinding {
                    subject_id: 1,
                    platform: "bangumi".to_string(),
                    subject_name: "Bangumi条目".to_string(),
                },
            )
            .await;
        store
            .set(
                "hash1",
                SubjectBinding {
                    subject_id: 2,
                    platform: "anilist".to_string(),
                    subject_name: "Anilist条目".to_string(),
                },
            )
            .await;

        let b1 = store
            .get("hash1", "bangumi")
            .await
            .expect("应能查到bangumi绑定");
        assert_eq!(b1.subject_id, 1);
        let b2 = store
            .get("hash1", "anilist")
            .await
            .expect("应能查到anilist绑定");
        assert_eq!(b2.subject_id, 2);

        // clear 只移除指定平台
        store.clear("hash1", "bangumi").await;
        assert_eq!(store.get("hash1", "bangumi").await, None);
        assert!(store.get("hash1", "anilist").await.is_some());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_绑定存储_覆盖已有绑定() {
        let store = setup_store().await;

        store
            .set(
                "hash1",
                SubjectBinding {
                    subject_id: 1,
                    platform: "bangumi".to_string(),
                    subject_name: "旧条目".to_string(),
                },
            )
            .await;
        store
            .set(
                "hash1",
                SubjectBinding {
                    subject_id: 2,
                    platform: "bangumi".to_string(),
                    subject_name: "新条目".to_string(),
                },
            )
            .await;

        let binding = store.get("hash1", "bangumi").await.expect("应能查到绑定");
        assert_eq!(binding.subject_id, 2);
        assert_eq!(binding.subject_name, "新条目");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_绑定存储_clear_all清除所有平台() {
        let store = setup_store().await;

        store
            .set(
                "hash1",
                SubjectBinding {
                    subject_id: 1,
                    platform: "bangumi".to_string(),
                    subject_name: "Bangumi条目".to_string(),
                },
            )
            .await;
        store
            .set(
                "hash1",
                SubjectBinding {
                    subject_id: 2,
                    platform: "anilist".to_string(),
                    subject_name: "Anilist条目".to_string(),
                },
            )
            .await;

        store.clear_all("hash1").await;
        assert_eq!(store.get("hash1", "bangumi").await, None);
        assert_eq!(store.get("hash1", "anilist").await, None);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_绑定存储_持久化跨实例重载() {
        let db = AppDatabase::connect_in_memory()
            .await
            .expect("内存库应成功");
        {
            let store = SqliteSubjectBindingRepository::new(&db).await;
            store
                .set(
                    "persist_hash",
                    SubjectBinding {
                        subject_id: 99,
                        platform: "bangumi".to_string(),
                        subject_name: "持久化条目".to_string(),
                    },
                )
                .await;
        }

        // 模拟重启：新实例从数据库重载
        let reloaded = SqliteSubjectBindingRepository::new(&db).await;
        let binding = reloaded
            .get("PERSIST_HASH", "bangumi")
            .await
            .expect("重启后应保留绑定");
        assert_eq!(binding.subject_id, 99);
        assert_eq!(binding.subject_name, "持久化条目");
    }
}
