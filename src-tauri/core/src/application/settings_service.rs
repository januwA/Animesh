use crate::domain::settings::SettingsRepository;
use crate::domain::torrent::TorrentRepository;
use crate::error::CoreResult;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

// 领域模型 AppSettings / AiConfig 已迁移至 domain::settings,这里重新导出以保持公共 API 稳定。
pub use crate::domain::settings::{AiConfig, AppSettings, TranslationConfig};

/// 应用设置用例:管理下载目录、代理、AI 配置、限速等持久化设置。
///
/// 限速类操作需要同时更新 `settings_repo`(持久化)与 `torrent_repo`(实时生效),
/// 此编排责任属于本服务。`download_dir_lock` 与 `SubtitleService` 共享,
/// 下载目录变更后立即对其他服务可见;代理配置直接读写 `settings_repo`,无需内存缓存。
pub struct SettingsService {
    settings_repo: Arc<dyn SettingsRepository>,
    torrent_repo: Arc<dyn TorrentRepository>,
    download_dir_lock: Arc<RwLock<PathBuf>>,
}

impl SettingsService {
    pub fn new(
        settings_repo: Arc<dyn SettingsRepository>,
        torrent_repo: Arc<dyn TorrentRepository>,
        download_dir_lock: Arc<RwLock<PathBuf>>,
    ) -> Self {
        Self {
            settings_repo,
            torrent_repo,
            download_dir_lock,
        }
    }

    /// 异步初始化方法,应用初始速度限制。
    pub async fn apply_initial_speed_limits(
        &self,
        max_download_speed: Option<u32>,
        max_upload_speed: Option<u32>,
    ) {
        if let Some(speed_kbps) = max_download_speed {
            if speed_kbps > 0 {
                let _ = self.set_max_download_speed(Some(speed_kbps)).await;
            }
        }
        if let Some(speed_kbps) = max_upload_speed {
            if speed_kbps > 0 {
                let _ = self.set_max_upload_speed(Some(speed_kbps)).await;
            }
        }
    }

    pub async fn get_download_dir(&self) -> String {
        self.download_dir_lock
            .read()
            .unwrap()
            .to_string_lossy()
            .to_string()
    }

    pub async fn set_download_dir(&self, dir: String) -> CoreResult<()> {
        let path = PathBuf::from(&dir);
        tokio::fs::create_dir_all(&path).await?;

        self.settings_repo.update_download_dir(&dir).await?;

        *self.download_dir_lock.write().unwrap() = path;
        Ok(())
    }

    pub async fn get_proxy(&self) -> Option<String> {
        self.settings_repo.get_proxy().await.ok().flatten()
    }

    pub async fn set_proxy(&self, proxy: Option<String>) -> CoreResult<()> {
        self.settings_repo.update_proxy(proxy.as_deref()).await
    }

    pub async fn get_settings(&self) -> CoreResult<AppSettings> {
        match self.settings_repo.get().await? {
            Some(settings) => Ok(settings),
            None => Ok(AppSettings {
                download_dir: self.get_download_dir().await,
                proxy: self.get_proxy().await,
                ai_configs: None,
                max_download_speed: None,
                max_upload_speed: None,
                translation: None,
            }),
        }
    }

    pub async fn set_ai_configs(&self, configs: Option<Vec<AiConfig>>) -> CoreResult<()> {
        self.settings_repo
            .update_ai_configs(configs.as_deref())
            .await
    }

    pub async fn set_translation_config(
        &self,
        config: Option<TranslationConfig>,
    ) -> CoreResult<()> {
        self.settings_repo
            .update_translation_config(config.as_ref())
            .await
    }

    pub async fn get_max_download_speed(&self) -> Option<u32> {
        self.get_settings()
            .await
            .ok()
            .and_then(|s| s.max_download_speed)
    }

    pub async fn set_max_download_speed(&self, max_speed: Option<u32>) -> CoreResult<()> {
        self.torrent_repo
            .set_max_download_speed(speed_kbps_to_bytes_per_sec(max_speed))
            .await;
        self.settings_repo
            .update_max_download_speed(max_speed)
            .await
    }

    pub async fn get_max_upload_speed(&self) -> Option<u32> {
        self.get_settings()
            .await
            .ok()
            .and_then(|s| s.max_upload_speed)
    }

    pub async fn set_max_upload_speed(&self, max_speed: Option<u32>) -> CoreResult<()> {
        self.torrent_repo
            .set_max_upload_speed(speed_kbps_to_bytes_per_sec(max_speed))
            .await;
        self.settings_repo.update_max_upload_speed(max_speed).await
    }
}

/// 将 KB/s 限速值转换为 bytes/s,0 或 None 表示不限速。
fn speed_kbps_to_bytes_per_sec(speed_kbps: Option<u32>) -> Option<u32> {
    speed_kbps.and_then(|kbps| {
        if kbps == 0 {
            None
        } else {
            Some(kbps.saturating_mul(1024))
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::db::AppDatabase;
    use crate::infrastructure::rqbit_torrent::create_torrent_repository;
    use crate::infrastructure::settings_repository::SqliteSettingsRepository;
    use crate::infrastructure::test_mocks::temp_dir;
    use std::path::PathBuf;

    /// 使用真实基础设施(内存 SQLite + 真实 librqbit 会话)构造设置服务。
    async fn build_service(dir: PathBuf) -> SettingsService {
        std::fs::create_dir_all(&dir).unwrap();
        let download_dir_lock = Arc::new(RwLock::new(dir.clone()));
        let db = Arc::new(
            AppDatabase::connect_in_memory()
                .await
                .expect("内存库应成功"),
        );
        let persistence_dir = dir.join(".torrents");
        let torrent_repo = create_torrent_repository(download_dir_lock.clone(), persistence_dir)
            .await
            .expect("创建 torrent repo 应成功");
        let settings_repo: Arc<dyn SettingsRepository> =
            Arc::new(SqliteSettingsRepository::new(&db));
        SettingsService::new(settings_repo, torrent_repo, download_dir_lock)
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_设置AI配置与下载速度限制_持久化() {
        let dir = temp_dir("settings_ai_speed");
        let service = build_service(dir).await;

        assert_eq!(service.get_max_download_speed().await, None);
        service
            .set_ai_configs(Some(vec![AiConfig {
                alias: "gpt".to_string(),
                api_endpoint: "https://example.com/v1".to_string(),
                api_key: "key".to_string(),
                ai_model: "gpt-4o".to_string(),
            }]))
            .await
            .expect("设置 AI 配置应成功");
        let settings = service.get_settings().await.expect("读取设置应成功");
        assert_eq!(settings.ai_configs.as_ref().unwrap()[0].alias, "gpt");

        service
            .set_max_download_speed(Some(256))
            .await
            .expect("设置下载限速应成功");
        assert_eq!(service.get_max_download_speed().await, Some(256));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_自定义下载目录_逻辑() {
        let dir = temp_dir("settings_download_dir");
        let service = build_service(dir.clone()).await;

        assert_eq!(
            service.get_download_dir().await,
            dir.to_string_lossy().to_string()
        );

        let new_dir = dir.join("custom_downloads");
        let new_dir_str = new_dir.to_string_lossy().to_string();
        service.set_download_dir(new_dir_str.clone()).await.unwrap();

        assert_eq!(service.get_download_dir().await, new_dir_str);

        // 通过仓储回读验证持久化(DB 取代 JSON)
        let settings = service.get_settings().await.unwrap();
        assert_eq!(settings.download_dir, new_dir_str);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_自定义代理_逻辑() {
        let dir = temp_dir("settings_proxy");
        let service = build_service(dir).await;

        assert_eq!(service.get_proxy().await, None);

        let proxy_str = "http://127.0.0.1:7890".to_string();
        service.set_proxy(Some(proxy_str.clone())).await.unwrap();

        assert_eq!(service.get_proxy().await, Some(proxy_str.clone()));

        // 通过仓储回读验证持久化(DB 取代 JSON)
        let settings = service.get_settings().await.unwrap();
        assert_eq!(settings.proxy, Some(proxy_str));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_上传速度限制_逻辑() {
        let dir = temp_dir("settings_upload");
        let service = build_service(dir).await;

        assert_eq!(service.get_max_upload_speed().await, None);

        service.set_max_upload_speed(Some(128)).await.unwrap();
        assert_eq!(service.get_max_upload_speed().await, Some(128));

        // 通过仓储回读验证持久化(DB 取代 JSON)
        let settings = service.get_settings().await.unwrap();
        assert_eq!(settings.max_upload_speed, Some(128));

        service.set_max_upload_speed(Some(0)).await.unwrap();
        assert_eq!(service.get_max_upload_speed().await, Some(0));

        service.set_max_upload_speed(None).await.unwrap();
        assert_eq!(service.get_max_upload_speed().await, None);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_字段级设置更新_空库初始化与清空() {
        // 取代旧的"异常JSON回退"测试:迁移到 DB 后不再有 JSON 解析路径,
        // 此测试覆盖空库场景下字段级 set/clear 行为。
        let dir = temp_dir("settings_persist_fresh");
        let service = build_service(dir.clone()).await;

        let next_dir = dir.join("custom_downloads");
        service
            .set_download_dir(next_dir.to_string_lossy().to_string())
            .await
            .unwrap();
        assert_eq!(
            service.get_download_dir().await,
            next_dir.to_string_lossy().to_string()
        );

        let proxy = "socks5://127.0.0.1:1080".to_string();
        service.set_proxy(Some(proxy.clone())).await.unwrap();
        assert_eq!(service.get_proxy().await, Some(proxy));

        service.set_max_download_speed(Some(0)).await.unwrap();
        service.set_max_download_speed(None).await.unwrap();
        assert_eq!(service.get_max_download_speed().await, None);

        service.set_max_upload_speed(Some(0)).await.unwrap();
        service.set_max_upload_speed(None).await.unwrap();
        assert_eq!(service.get_max_upload_speed().await, None);

        service.set_ai_configs(None).await.unwrap();
        let settings = service.get_settings().await.unwrap();
        assert!(settings.ai_configs.is_none());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_应用初始速度限制_仅对非零值生效() {
        let dir = temp_dir("settings_initial_speed");
        let service = build_service(dir).await;

        // None 不应触发持久化
        service.apply_initial_speed_limits(None, None).await;
        assert_eq!(service.get_max_download_speed().await, None);
        assert_eq!(service.get_max_upload_speed().await, None);

        // Some(0) 进入 if let 但跳过内层 if(零值不应触发持久化)
        service.apply_initial_speed_limits(Some(0), Some(0)).await;
        assert_eq!(service.get_max_download_speed().await, None);
        assert_eq!(service.get_max_upload_speed().await, None);

        // 非零值应被持久化
        service
            .apply_initial_speed_limits(Some(100), Some(200))
            .await;
        assert_eq!(service.get_max_download_speed().await, Some(100));
        assert_eq!(service.get_max_upload_speed().await, Some(200));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_设置翻译配置_持久化与清空() {
        let dir = temp_dir("settings_translation");
        let service = build_service(dir).await;

        assert!(service.get_settings().await.unwrap().translation.is_none());

        let config = TranslationConfig {
            target_lang: "ja".to_string(),
            provider: crate::domain::settings::TranslationProvider::Ai,
            ai_config_alias: Some("gpt".to_string()),
        };
        service
            .set_translation_config(Some(config.clone()))
            .await
            .unwrap();
        let settings = service.get_settings().await.unwrap();
        assert_eq!(settings.translation.as_ref().unwrap(), &config);

        service.set_translation_config(None).await.unwrap();
        assert!(service.get_settings().await.unwrap().translation.is_none());
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_将KB每秒限制转换为bytes每秒() {
        assert_eq!(speed_kbps_to_bytes_per_sec(None), None);
        assert_eq!(speed_kbps_to_bytes_per_sec(Some(0)), None);
        assert_eq!(speed_kbps_to_bytes_per_sec(Some(128)), Some(128 * 1024));
        assert_eq!(speed_kbps_to_bytes_per_sec(Some(u32::MAX)), Some(u32::MAX));
    }
}
