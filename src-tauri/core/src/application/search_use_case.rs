use crate::domain::crawler::{CrawlerRepository, SearchResultItem};
use crate::domain::settings::SettingsRepository;
use crate::error::{CoreError, CoreResult};
use std::sync::Arc;

/// 资源搜索用例:按引擎分发搜索请求。
///
/// 代理地址在执行时通过 `settings_repo` 实时读取,设置变更后立即对后续搜索生效。
pub struct SearchUseCase {
    crawler_repo: Arc<dyn CrawlerRepository>,
    settings_repo: Arc<dyn SettingsRepository>,
}

impl SearchUseCase {
    pub fn new(
        crawler_repo: Arc<dyn CrawlerRepository>,
        settings_repo: Arc<dyn SettingsRepository>,
    ) -> Self {
        Self {
            crawler_repo,
            settings_repo,
        }
    }

    /// 按引擎分发搜索请求,返回搜索结果。
    pub async fn execute(&self, engine: &str, keyword: &str) -> CoreResult<Vec<SearchResultItem>> {
        let proxy = self.settings_repo.get_proxy().await?;
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
    use crate::infrastructure::db::AppDatabase;
    use crate::infrastructure::settings_repository::SqliteSettingsRepository;
    use crate::infrastructure::test_mocks::MockCrawlerRepository;

    async fn build_use_case() -> SearchUseCase {
        let db = AppDatabase::connect_in_memory()
            .await
            .expect("内存库应成功");
        let settings_repo: Arc<dyn SettingsRepository> =
            Arc::new(SqliteSettingsRepository::new(&db));
        SearchUseCase::new(Arc::new(MockCrawlerRepository), settings_repo)
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_搜索_各引擎分发与未知引擎报错() {
        let use_case = build_use_case().await;

        for (engine, expected_title) in [
            ("dmhy", "dmhy-条目"),
            ("bangumi_moe", "bangumi_moe-条目"),
            ("mikan", "mikan-条目"),
            ("nyaa", "nyaa-条目"),
            ("acgrip", "acgrip-条目"),
            ("anibt", "anibt-条目"),
        ] {
            let items = use_case
                .execute(engine, "关键词")
                .await
                .expect("搜索应成功");
            assert_eq!(items.len(), 1);
            assert_eq!(items[0].title, expected_title);
        }

        let err = use_case.execute("unknown", "关键词").await;
        assert!(err
            .unwrap_err()
            .to_string()
            .contains("Unsupported search engine"));
    }
}
