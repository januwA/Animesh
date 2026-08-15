use crate::domain::torrent::{SubjectBinding, SubjectBindingRepository};
use crate::infrastructure::db::AppDatabase;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::RwLock;

/// 下载资源与条目的绑定关系仓储，按 info_hash（小写）唯一标识。
/// 启动时从 SQLite 加载到内存作为读缓存，写入时直写内存与数据库（失败回滚内存）。
pub struct SqliteSubjectBindingRepository {
    bindings: RwLock<HashMap<String, SubjectBinding>>,
    pool: sqlx::SqlitePool,
}

impl SqliteSubjectBindingRepository {
    pub async fn new(db: &AppDatabase) -> Self {
        let pool = db.pool().clone();
        let rows = sqlx::query_as::<_, (String, i64, String)>(
            "SELECT info_hash, subject_id, subject_name FROM torrent_subject_bindings",
        )
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
        let mut bindings = HashMap::with_capacity(rows.len());
        for (hash, subject_id, subject_name) in rows {
            bindings.insert(
                hash,
                SubjectBinding {
                    subject_id: subject_id as u64,
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
    async fn get(&self, info_hash: &str) -> Option<SubjectBinding> {
        self.bindings
            .read()
            .unwrap()
            .get(&info_hash.to_lowercase())
            .cloned()
    }

    async fn set(&self, info_hash: &str, binding: SubjectBinding) {
        let key = info_hash.to_lowercase();
        {
            let mut bindings = self.bindings.write().unwrap();
            bindings.insert(key.clone(), binding.clone());
        }
        let result = sqlx::query(
            "INSERT INTO torrent_subject_bindings (info_hash, subject_id, subject_name) VALUES (?, ?, ?)
             ON CONFLICT(info_hash) DO UPDATE SET subject_id = excluded.subject_id, subject_name = excluded.subject_name",
        )
        .bind(&key)
        .bind(binding.subject_id as i64)
        .bind(&binding.subject_name)
        .execute(&self.pool)
        .await;
        if result.is_err() {
            self.bindings.write().unwrap().remove(&key);
        }
    }

    async fn clear(&self, info_hash: &str) {
        let key = info_hash.to_lowercase();
        let removed = self.bindings.write().unwrap().remove(&key);
        let result = sqlx::query("DELETE FROM torrent_subject_bindings WHERE info_hash = ?")
            .bind(&key)
            .execute(&self.pool)
            .await;
        if result.is_err() {
            if let Some(binding) = removed {
                self.bindings.write().unwrap().insert(key, binding);
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
        assert_eq!(store.get(hash).await, None);

        store
            .set(
                hash,
                SubjectBinding {
                    subject_id: 42,
                    subject_name: "测试条目".to_string(),
                },
            )
            .await;

        // 大小写不敏感查找
        let binding = store.get("abc123").await.expect("应能查到绑定");
        assert_eq!(binding.subject_id, 42);
        assert_eq!(binding.subject_name, "测试条目");

        store.clear(hash).await;
        assert_eq!(store.get(hash).await, None);
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
                    subject_name: "旧条目".to_string(),
                },
            )
            .await;
        store
            .set(
                "hash1",
                SubjectBinding {
                    subject_id: 2,
                    subject_name: "新条目".to_string(),
                },
            )
            .await;

        let binding = store.get("hash1").await.expect("应能查到绑定");
        assert_eq!(binding.subject_id, 2);
        assert_eq!(binding.subject_name, "新条目");
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
                        subject_name: "持久化条目".to_string(),
                    },
                )
                .await;
        }

        // 模拟重启：新实例从数据库重载
        let reloaded = SqliteSubjectBindingRepository::new(&db).await;
        let binding = reloaded
            .get("PERSIST_HASH")
            .await
            .expect("重启后应保留绑定");
        assert_eq!(binding.subject_id, 99);
        assert_eq!(binding.subject_name, "持久化条目");
    }
}
