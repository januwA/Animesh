use crate::domain::collection::{CollectionRecord, CollectionRepository, NewCollectionItem};
use crate::infrastructure::db::AppDatabase;
use sqlx::Row;

/// 基于 SQLite 的收藏仓储。
#[derive(Clone)]
pub struct SqliteCollectionRepository {
    pool: sqlx::SqlitePool,
}

impl SqliteCollectionRepository {
    pub fn new(db: &AppDatabase) -> Self {
        Self {
            pool: db.pool().clone(),
        }
    }
}

#[async_trait::async_trait]
impl CollectionRepository for SqliteCollectionRepository {
    /// 查询全部收藏，按收藏时间倒序。
    async fn list(&self) -> Result<Vec<CollectionRecord>, sqlx::Error> {
        sqlx::query_as::<_, CollectionRecord>(
            "SELECT subject_id, name, image_url, added_at FROM collections ORDER BY added_at DESC",
        )
        .fetch_all(&self.pool)
        .await
    }

    async fn is_favorited(&self, subject_id: i64) -> Result<bool, sqlx::Error> {
        let row = sqlx::query("SELECT COUNT(*) FROM collections WHERE subject_id = ?")
            .bind(subject_id)
            .fetch_one(&self.pool)
            .await?;
        let count: i64 = row.get(0);
        Ok(count > 0)
    }

    /// 新增收藏，已存在时保持幂等（不重复插入）。
    async fn add(&self, item: NewCollectionItem) -> Result<(), sqlx::Error> {
        let added_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        sqlx::query(
            "INSERT INTO collections (subject_id, name, image_url, added_at) VALUES (?, ?, ?, ?)
             ON CONFLICT(subject_id) DO NOTHING",
        )
        .bind(item.subject_id)
        .bind(&item.name)
        .bind(&item.image_url)
        .bind(added_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn remove(&self, subject_id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM collections WHERE subject_id = ?")
            .bind(subject_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::db::AppDatabase;

    async fn setup() -> SqliteCollectionRepository {
        let db = AppDatabase::connect_in_memory()
            .await
            .expect("内存库应成功");
        SqliteCollectionRepository::new(&db)
    }

    #[tokio::test]
    async fn 测试_添加后列表包含记录且倒序() {
        let repo = setup().await;
        repo.add(NewCollectionItem {
            subject_id: 1,
            name: "旧条目".to_string(),
            image_url: Some("http://a/1.jpg".to_string()),
        })
        .await
        .expect("添加应成功");
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;
        repo.add(NewCollectionItem {
            subject_id: 2,
            name: "新条目".to_string(),
            image_url: None,
        })
        .await
        .expect("添加应成功");

        let items = repo.list().await.expect("列表应成功");
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].subject_id, 2);
        assert_eq!(items[1].subject_id, 1);
        assert_eq!(items[1].image_url.as_deref(), Some("http://a/1.jpg"));
        assert!(items[0].added_at > 0);
    }

    #[tokio::test]
    async fn 测试_重复添加同一条目_幂等不重复() {
        let repo = setup().await;
        for _ in 0..2 {
            repo.add(NewCollectionItem {
                subject_id: 7,
                name: "条目".to_string(),
                image_url: None,
            })
            .await
            .expect("添加应成功");
        }
        let items = repo.list().await.expect("列表应成功");
        assert_eq!(items.len(), 1);
    }

    #[tokio::test]
    async fn 测试_收藏状态判断() {
        let repo = setup().await;
        assert!(!repo.is_favorited(3).await.expect("查询应成功"));
        repo.add(NewCollectionItem {
            subject_id: 3,
            name: "条目".to_string(),
            image_url: None,
        })
        .await
        .expect("添加应成功");
        assert!(repo.is_favorited(3).await.expect("查询应成功"));
    }

    #[tokio::test]
    async fn 测试_移除收藏() {
        let repo = setup().await;
        repo.add(NewCollectionItem {
            subject_id: 4,
            name: "条目".to_string(),
            image_url: None,
        })
        .await
        .expect("添加应成功");
        repo.remove(4).await.expect("移除应成功");
        assert!(!repo.is_favorited(4).await.expect("查询应成功"));
        assert!(repo.list().await.expect("列表应成功").is_empty());
    }
}
