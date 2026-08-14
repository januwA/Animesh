use crate::domain::collection::{CollectionRecord, CollectionRepository, NewCollectionItem};
use std::sync::Arc;

/// 收藏领域用例，负责将存储层错误映射为表现层可读的错误信息。
pub struct CollectionService {
    repo: Arc<dyn CollectionRepository>,
}

impl CollectionService {
    pub fn new(repo: Arc<dyn CollectionRepository>) -> Self {
        Self { repo }
    }

    pub async fn list(&self) -> Result<Vec<CollectionRecord>, String> {
        self.repo.list().await.map_err(|e| e.to_string())
    }

    pub async fn is_favorited(&self, subject_id: i64) -> Result<bool, String> {
        self.repo
            .is_favorited(subject_id)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn add(&self, item: NewCollectionItem) -> Result<(), String> {
        self.repo.add(item).await.map_err(|e| e.to_string())
    }

    pub async fn remove(&self, subject_id: i64) -> Result<(), String> {
        self.repo
            .remove(subject_id)
            .await
            .map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::collection::CollectionRepository;
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};

    #[derive(Default)]
    struct MockCollectionRepository {
        records: Arc<Mutex<Vec<CollectionRecord>>>,
        fail_with: Option<String>,
    }

    impl MockCollectionRepository {
        fn fail(error: &str) -> Self {
            Self {
                fail_with: Some(error.to_string()),
                ..Default::default()
            }
        }
    }

    #[async_trait]
    impl CollectionRepository for MockCollectionRepository {
        async fn list(&self) -> Result<Vec<CollectionRecord>, sqlx::Error> {
            if let Some(msg) = &self.fail_with {
                return Err(sqlx::Error::Protocol(msg.to_string()));
            }
            Ok(self.records.lock().unwrap().clone())
        }
        async fn is_favorited(&self, subject_id: i64) -> Result<bool, sqlx::Error> {
            if let Some(msg) = &self.fail_with {
                return Err(sqlx::Error::Protocol(msg.to_string()));
            }
            Ok(self
                .records
                .lock()
                .unwrap()
                .iter()
                .any(|r| r.subject_id == subject_id))
        }
        async fn add(&self, item: NewCollectionItem) -> Result<(), sqlx::Error> {
            if let Some(msg) = &self.fail_with {
                return Err(sqlx::Error::Protocol(msg.to_string()));
            }
            self.records.lock().unwrap().push(CollectionRecord {
                subject_id: item.subject_id,
                name: item.name,
                image_url: item.image_url,
                added_at: 1,
            });
            Ok(())
        }
        async fn remove(&self, subject_id: i64) -> Result<(), sqlx::Error> {
            if let Some(msg) = &self.fail_with {
                return Err(sqlx::Error::Protocol(msg.to_string()));
            }
            self.records
                .lock()
                .unwrap()
                .retain(|r| r.subject_id != subject_id);
            Ok(())
        }
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_收藏增删查改() {
        let repo = Arc::new(MockCollectionRepository::default());
        let records = repo.records.clone();
        let service = CollectionService::new(repo);

        assert!(service.list().await.expect("列表应成功").is_empty());
        assert!(!service.is_favorited(1).await.expect("查询应成功"));

        service
            .add(NewCollectionItem {
                subject_id: 1,
                name: "条目".to_string(),
                image_url: Some("http://a/1.jpg".to_string()),
            })
            .await
            .expect("添加应成功");
        assert!(service.is_favorited(1).await.expect("查询应成功"));
        assert_eq!(service.list().await.expect("列表应成功").len(), 1);
        assert_eq!(
            records.lock().unwrap()[0].image_url.as_deref(),
            Some("http://a/1.jpg")
        );

        service.remove(1).await.expect("移除应成功");
        assert!(!service.is_favorited(1).await.expect("查询应成功"));
        assert!(service.list().await.expect("列表应成功").is_empty());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_存储层错误映射为字符串() {
        let service =
            CollectionService::new(Arc::new(MockCollectionRepository::fail("数据库繁忙")));

        assert!(service.list().await.is_err());
        assert!(service.is_favorited(1).await.is_err());
        assert!(service
            .add(NewCollectionItem {
                subject_id: 1,
                name: "条目".to_string(),
                image_url: None,
            })
            .await
            .is_err());
        assert!(service.remove(1).await.is_err());
    }
}
