use serde::Serialize;
use sqlx::FromRow;

/// 收藏条目的领域模型，同时作为后端返回给前端的 JSON 结构。
#[derive(Debug, Clone, Serialize, FromRow, PartialEq)]
pub struct CollectionRecord {
    pub subject_id: i64,
    pub name: String,
    pub image_url: Option<String>,
    pub added_at: i64,
}

/// 新增收藏所需的字段，added_at 由仓储填充。
pub struct NewCollectionItem {
    pub subject_id: i64,
    pub name: String,
    pub image_url: Option<String>,
}

/// 收藏仓储接口，由基础设施层（SQLite）实现。
#[async_trait::async_trait]
pub trait CollectionRepository: Send + Sync {
    async fn list(&self) -> Result<Vec<CollectionRecord>, sqlx::Error>;
    async fn is_favorited(&self, subject_id: i64) -> Result<bool, sqlx::Error>;
    async fn add(&self, item: NewCollectionItem) -> Result<(), sqlx::Error>;
    async fn remove(&self, subject_id: i64) -> Result<(), sqlx::Error>;
}
