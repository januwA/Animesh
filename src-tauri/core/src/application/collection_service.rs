use crate::domain::collection::{CollectionRecord, CollectionRepository, NewCollectionItem};
use crate::error::CoreResult;
use std::sync::Arc;

/// 收藏领域用例，将领域仓储能力编排为面向表现层的应用服务。
pub struct CollectionService {
    repo: Arc<dyn CollectionRepository>,
}

impl CollectionService {
    pub fn new(repo: Arc<dyn CollectionRepository>) -> Self {
        Self { repo }
    }

    pub async fn list(&self) -> CoreResult<Vec<CollectionRecord>> {
        self.repo.list().await
    }

    pub async fn is_favorited(&self, subject_id: i64, platform: &str) -> CoreResult<bool> {
        self.repo.is_favorited(subject_id, platform).await
    }

    pub async fn add(&self, item: NewCollectionItem) -> CoreResult<()> {
        self.repo.add(item).await
    }

    pub async fn remove(&self, subject_id: i64, platform: &str) -> CoreResult<()> {
        self.repo.remove(subject_id, platform).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::collection::CollectionRepository;
    use crate::error::CoreError;
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
        async fn list(&self) -> CoreResult<Vec<CollectionRecord>> {
            if let Some(msg) = &self.fail_with {
                return Err(CoreError::Message(msg.clone()));
            }
            Ok(self.records.lock().unwrap().clone())
        }
        async fn is_favorited(&self, subject_id: i64, platform: &str) -> CoreResult<bool> {
            if let Some(msg) = &self.fail_with {
                return Err(CoreError::Message(msg.clone()));
            }
            Ok(self
                .records
                .lock()
                .unwrap()
                .iter()
                .any(|r| r.subject_id == subject_id && r.platform == platform))
        }
        async fn add(&self, item: NewCollectionItem) -> CoreResult<()> {
            if let Some(msg) = &self.fail_with {
                return Err(CoreError::Message(msg.clone()));
            }
            self.records.lock().unwrap().push(CollectionRecord {
                subject_id: item.subject_id,
                platform: item.platform,
                name: item.name,
                image_url: item.image_url,
                added_at: 1,
            });
            Ok(())
        }
        async fn remove(&self, subject_id: i64, platform: &str) -> CoreResult<()> {
            if let Some(msg) = &self.fail_with {
                return Err(CoreError::Message(msg.clone()));
            }
            self.records
                .lock()
                .unwrap()
                .retain(|r| !(r.subject_id == subject_id && r.platform == platform));
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
        assert!(!service
            .is_favorited(1, "bangumi")
            .await
            .expect("查询应成功"));

        service
            .add(NewCollectionItem {
                subject_id: 1,
                platform: "bangumi".to_string(),
                name: "条目".to_string(),
                image_url: Some("http://a/1.jpg".to_string()),
            })
            .await
            .expect("添加应成功");
        assert!(service
            .is_favorited(1, "bangumi")
            .await
            .expect("查询应成功"));
        assert_eq!(service.list().await.expect("列表应成功").len(), 1);
        assert_eq!(
            records.lock().unwrap()[0].image_url.as_deref(),
            Some("http://a/1.jpg")
        );

        service.remove(1, "bangumi").await.expect("移除应成功");
        assert!(!service
            .is_favorited(1, "bangumi")
            .await
            .expect("查询应成功"));
        assert!(service.list().await.expect("列表应成功").is_empty());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_存储层错误映射为字符串() {
        let service =
            CollectionService::new(Arc::new(MockCollectionRepository::fail("数据库繁忙")));

        let err = service.list().await.unwrap_err();
        assert_eq!(err.to_string(), "数据库繁忙");
        assert!(service.is_favorited(1, "bangumi").await.is_err());
        assert!(service
            .add(NewCollectionItem {
                subject_id: 1,
                platform: "bangumi".to_string(),
                name: "条目".to_string(),
                image_url: None,
            })
            .await
            .is_err());
        assert!(service.remove(1, "bangumi").await.is_err());
    }
}
