use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct SearchResultItem {
    pub title: String,
    pub link: String,
    pub pub_date: String,
    pub magnet: String,
    pub size: Option<u64>,
}

#[async_trait::async_trait]
pub trait CrawlerRepository: Send + Sync {
    async fn search_dmhy(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, String>;

    async fn search_bangumi_moe(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, String>;

    async fn search_mikan(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, String>;

    async fn search_nyaa(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, String>;
}
