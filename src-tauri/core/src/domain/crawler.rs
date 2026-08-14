use serde::{Deserialize, Serialize};

use crate::error::CoreError;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct SearchResultItem {
    pub title: String,
    pub link: String,
    pub pub_date: String,
    pub magnet: String,
    pub description: String,
}

#[async_trait::async_trait]
pub trait CrawlerRepository: Send + Sync {
    async fn search_dmhy(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError>;

    async fn search_bangumi_moe(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError>;

    async fn search_mikan(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError>;

    async fn search_nyaa(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError>;

    async fn search_acgrip(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError>;

    async fn search_anibt(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError>;
}
