use crate::domain::crawler::{CrawlerRepository, SearchResultItem};
use crate::error::{CoreError, CoreResult};
use std::sync::{Arc, RwLock};

/// 资源搜索用例:按引擎分发搜索请求。
///
/// 代理地址通过 `proxy_lock` 注入,与 `SettingsService` 共享同一份内存状态,
/// 设置变更后立即对后续搜索生效。
pub struct SearchService {
    crawler_repo: Arc<dyn CrawlerRepository>,
    proxy_lock: Arc<RwLock<Option<String>>>,
}

impl SearchService {
    pub fn new(
        crawler_repo: Arc<dyn CrawlerRepository>,
        proxy_lock: Arc<RwLock<Option<String>>>,
    ) -> Self {
        Self {
            crawler_repo,
            proxy_lock,
        }
    }

    /// 按引擎分发搜索请求,返回搜索结果。
    pub async fn search(&self, engine: &str, keyword: &str) -> CoreResult<Vec<SearchResultItem>> {
        let proxy = self.proxy_lock.read().unwrap().clone();
        match engine {
            "dmhy" => self.crawler_repo.search_dmhy(keyword, proxy).await,
            "bangumi_moe" => self.crawler_repo.search_bangumi_moe(keyword, proxy).await,
            "mikan" => self.crawler_repo.search_mikan(keyword, proxy).await,
            "nyaa" => self.crawler_repo.search_nyaa(keyword, proxy).await,
            "acgrip" => self.crawler_repo.search_acgrip(keyword, proxy).await,
            "anibt" => self.crawler_repo.search_anibt(keyword, proxy).await,
            _ => Err(CoreError::UnsupportedSearchEngine(engine.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::test_mocks::MockCrawlerRepository;

    fn build_service() -> SearchService {
        SearchService::new(Arc::new(MockCrawlerRepository), Arc::new(RwLock::new(None)))
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_搜索_各引擎分发与未知引擎报错() {
        let service = build_service();

        for (engine, expected_title) in [
            ("dmhy", "dmhy-条目"),
            ("bangumi_moe", "bangumi_moe-条目"),
            ("mikan", "mikan-条目"),
            ("nyaa", "nyaa-条目"),
            ("acgrip", "acgrip-条目"),
            ("anibt", "anibt-条目"),
        ] {
            let items = service.search(engine, "关键词").await.expect("搜索应成功");
            assert_eq!(items.len(), 1);
            assert_eq!(items[0].title, expected_title);
        }

        let err = service.search("unknown", "关键词").await;
        assert!(err
            .unwrap_err()
            .to_string()
            .contains("Unsupported search engine"));
    }
}
