use crate::domain::settings::{AiConfig, AppSettings, SettingsRepository};
use crate::error::CoreResult;
use crate::infrastructure::db::AppDatabase;
use sqlx::Row;

/// 基于 SQLite 的设置仓储，对应 app_settings 表的单行记录（id = 1）。
#[derive(Clone)]
pub struct SqliteSettingsRepository {
    pool: sqlx::SqlitePool,
}

impl SqliteSettingsRepository {
    pub fn new(db: &AppDatabase) -> Self {
        Self {
            pool: db.pool().clone(),
        }
    }

    /// 确保设置行存在。若不存在则用空 download_dir 插入占位行。
    /// 实际初始化应在应用启动时通过 `ensure_initialized` 完成；
    /// 此方法仅作为字段级更新的兜底，避免 NOT NULL 约束失败。
    async fn ensure_row_exists(&self) -> CoreResult<()> {
        sqlx::query(
            "INSERT OR IGNORE INTO app_settings (id, download_dir, proxy, ai_configs, max_download_speed, max_upload_speed)
             VALUES (1, '', NULL, NULL, NULL, NULL)",
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

#[async_trait::async_trait]
impl SettingsRepository for SqliteSettingsRepository {
    async fn get(&self) -> CoreResult<Option<AppSettings>> {
        let row = sqlx::query(
            "SELECT download_dir, proxy, ai_configs, max_download_speed, max_upload_speed
             FROM app_settings WHERE id = 1",
        )
        .fetch_optional(&self.pool)
        .await?;
        match row {
            None => Ok(None),
            Some(row) => {
                let ai_configs = parse_ai_configs(row.try_get::<Option<String>, _>("ai_configs")?)?;
                Ok(Some(AppSettings {
                    download_dir: row.try_get("download_dir")?,
                    proxy: row.try_get("proxy")?,
                    ai_configs,
                    max_download_speed: row
                        .try_get::<Option<i64>, _>("max_download_speed")?
                        .and_then(|v| v.try_into().ok()),
                    max_upload_speed: row
                        .try_get::<Option<i64>, _>("max_upload_speed")?
                        .and_then(|v| v.try_into().ok()),
                }))
            }
        }
    }

    async fn upsert(&self, settings: &AppSettings) -> CoreResult<()> {
        let ai_configs_json = serialize_ai_configs(settings.ai_configs.as_deref())?;
        sqlx::query(
            "INSERT INTO app_settings (id, download_dir, proxy, ai_configs, max_download_speed, max_upload_speed)
             VALUES (1, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                download_dir = excluded.download_dir,
                proxy = excluded.proxy,
                ai_configs = excluded.ai_configs,
                max_download_speed = excluded.max_download_speed,
                max_upload_speed = excluded.max_upload_speed",
        )
        .bind(&settings.download_dir)
        .bind(settings.proxy.as_deref())
        .bind(ai_configs_json)
        .bind(settings.max_download_speed.map(|v| v as i64))
        .bind(settings.max_upload_speed.map(|v| v as i64))
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn ensure_initialized(&self, default: &AppSettings) -> CoreResult<AppSettings> {
        if let Some(existing) = self.get().await? {
            return Ok(existing);
        }
        self.upsert(default).await?;
        Ok(default.clone())
    }

    async fn update_download_dir(&self, dir: &str) -> CoreResult<()> {
        self.ensure_row_exists().await?;
        sqlx::query("UPDATE app_settings SET download_dir = ? WHERE id = 1")
            .bind(dir)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn update_proxy(&self, proxy: Option<&str>) -> CoreResult<()> {
        self.ensure_row_exists().await?;
        sqlx::query("UPDATE app_settings SET proxy = ? WHERE id = 1")
            .bind(proxy)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn get_proxy(&self) -> CoreResult<Option<String>> {
        let row = sqlx::query("SELECT proxy FROM app_settings WHERE id = 1")
            .fetch_optional(&self.pool)
            .await?;
        match row {
            None => Ok(None),
            Some(row) => Ok(row.try_get("proxy")?),
        }
    }

    async fn update_ai_configs(&self, configs: Option<&[AiConfig]>) -> CoreResult<()> {
        self.ensure_row_exists().await?;
        let json = serialize_ai_configs(configs)?;
        sqlx::query("UPDATE app_settings SET ai_configs = ? WHERE id = 1")
            .bind(json)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn update_max_download_speed(&self, speed: Option<u32>) -> CoreResult<()> {
        self.ensure_row_exists().await?;
        sqlx::query("UPDATE app_settings SET max_download_speed = ? WHERE id = 1")
            .bind(speed.map(|v| v as i64))
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn update_max_upload_speed(&self, speed: Option<u32>) -> CoreResult<()> {
        self.ensure_row_exists().await?;
        sqlx::query("UPDATE app_settings SET max_upload_speed = ? WHERE id = 1")
            .bind(speed.map(|v| v as i64))
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

fn serialize_ai_configs(configs: Option<&[AiConfig]>) -> CoreResult<Option<String>> {
    match configs {
        None => Ok(None),
        Some(slice) => {
            if slice.is_empty() {
                Ok(Some("[]".to_string()))
            } else {
                Ok(Some(serde_json::to_string(slice)?))
            }
        }
    }
}

fn parse_ai_configs(raw: Option<String>) -> CoreResult<Option<Vec<AiConfig>>> {
    match raw {
        None => Ok(None),
        Some(s) if s.is_empty() => Ok(None),
        Some(s) => {
            let configs: Vec<AiConfig> = serde_json::from_str(&s)?;
            Ok(Some(configs))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::db::AppDatabase;

    async fn setup() -> SqliteSettingsRepository {
        let db = AppDatabase::connect_in_memory()
            .await
            .expect("内存库应成功");
        SqliteSettingsRepository::new(&db)
    }

    fn default_settings(download_dir: &str) -> AppSettings {
        AppSettings {
            download_dir: download_dir.to_string(),
            proxy: None,
            ai_configs: None,
            max_download_speed: None,
            max_upload_speed: None,
        }
    }

    fn sample_ai_configs() -> Vec<AiConfig> {
        vec![AiConfig {
            alias: "gpt".to_string(),
            api_endpoint: "https://example.com/v1".to_string(),
            api_key: "key".to_string(),
            ai_model: Some("gpt-4o".to_string()),
        }]
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_空库get返回None() {
        let repo = setup().await;
        assert!(repo.get().await.expect("查询应成功").is_none());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_upsert写入并可读回() {
        let repo = setup().await;
        let settings = AppSettings {
            download_dir: "/tmp/dl".to_string(),
            proxy: Some("http://127.0.0.1:7890".to_string()),
            ai_configs: Some(sample_ai_configs()),
            max_download_speed: Some(256),
            max_upload_speed: Some(128),
        };
        repo.upsert(&settings).await.expect("写入应成功");
        let loaded = repo.get().await.expect("查询应成功").expect("应存在记录");
        assert_eq!(loaded, settings);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_upsert覆盖更新() {
        let repo = setup().await;
        repo.upsert(&default_settings("/tmp/old")).await.unwrap();
        repo.upsert(&AppSettings {
            download_dir: "/tmp/new".to_string(),
            proxy: Some("socks5://127.0.0.1:1080".to_string()),
            ai_configs: None,
            max_download_speed: Some(100),
            max_upload_speed: None,
        })
        .await
        .unwrap();
        let loaded = repo.get().await.unwrap().unwrap();
        assert_eq!(loaded.download_dir, "/tmp/new");
        assert_eq!(loaded.proxy.as_deref(), Some("socks5://127.0.0.1:1080"));
        assert_eq!(loaded.max_download_speed, Some(100));
        assert!(loaded.ai_configs.is_none());
        assert!(loaded.max_upload_speed.is_none());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_ensureInitialized_行不存在时写入默认值() {
        let repo = setup().await;
        let default = default_settings("/tmp/default");
        let result = repo
            .ensure_initialized(&default)
            .await
            .expect("初始化应成功");
        assert_eq!(result, default);
        let loaded = repo.get().await.unwrap().unwrap();
        assert_eq!(loaded, default);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_ensureInitialized_行已存在时保持不变() {
        let repo = setup().await;
        let existing = AppSettings {
            download_dir: "/tmp/existing".to_string(),
            proxy: Some("http://proxy".to_string()),
            ai_configs: None,
            max_download_speed: Some(500),
            max_upload_speed: None,
        };
        repo.upsert(&existing).await.unwrap();
        let default = default_settings("/tmp/default");
        let result = repo.ensure_initialized(&default).await.unwrap();
        assert_eq!(result, existing);
        assert_ne!(result, default);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_update_download_dir_原子更新() {
        let repo = setup().await;
        repo.upsert(&AppSettings {
            download_dir: "/tmp/old".to_string(),
            proxy: Some("http://proxy".to_string()),
            ai_configs: Some(sample_ai_configs()),
            max_download_speed: Some(100),
            max_upload_speed: Some(50),
        })
        .await
        .unwrap();
        repo.update_download_dir("/tmp/new").await.unwrap();
        let loaded = repo.get().await.unwrap().unwrap();
        assert_eq!(loaded.download_dir, "/tmp/new");
        // 其他字段保持不变
        assert_eq!(loaded.proxy.as_deref(), Some("http://proxy"));
        assert_eq!(loaded.ai_configs.unwrap().len(), 1);
        assert_eq!(loaded.max_download_speed, Some(100));
        assert_eq!(loaded.max_upload_speed, Some(50));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_update_proxy_可设置与清除() {
        let repo = setup().await;
        repo.upsert(&default_settings("/tmp/dl")).await.unwrap();
        repo.update_proxy(Some("http://127.0.0.1:7890"))
            .await
            .unwrap();
        assert_eq!(
            repo.get().await.unwrap().unwrap().proxy.as_deref(),
            Some("http://127.0.0.1:7890")
        );
        repo.update_proxy(None).await.unwrap();
        assert!(repo.get().await.unwrap().unwrap().proxy.is_none());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_get_proxy_空库返回None且读取已存值() {
        let repo = setup().await;
        assert_eq!(repo.get_proxy().await.expect("查询应成功"), None);

        repo.update_proxy(Some("http://127.0.0.1:7890"))
            .await
            .unwrap();
        assert_eq!(
            repo.get_proxy().await.expect("查询应成功").as_deref(),
            Some("http://127.0.0.1:7890")
        );

        repo.update_proxy(None).await.unwrap();
        assert_eq!(repo.get_proxy().await.expect("查询应成功"), None);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_update_ai_configs_序列化与回读() {
        let repo = setup().await;
        repo.upsert(&default_settings("/tmp/dl")).await.unwrap();
        let configs = sample_ai_configs();
        repo.update_ai_configs(Some(&configs)).await.unwrap();
        let loaded = repo.get().await.unwrap().unwrap();
        assert_eq!(loaded.ai_configs.as_ref().unwrap(), &configs);
        repo.update_ai_configs(None).await.unwrap();
        assert!(repo.get().await.unwrap().unwrap().ai_configs.is_none());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_update_max_download_speed_可设置与清除() {
        let repo = setup().await;
        repo.upsert(&default_settings("/tmp/dl")).await.unwrap();
        repo.update_max_download_speed(Some(256)).await.unwrap();
        assert_eq!(
            repo.get().await.unwrap().unwrap().max_download_speed,
            Some(256)
        );
        repo.update_max_download_speed(None).await.unwrap();
        assert!(repo
            .get()
            .await
            .unwrap()
            .unwrap()
            .max_download_speed
            .is_none());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_update_max_upload_speed_可设置与清除() {
        let repo = setup().await;
        repo.upsert(&default_settings("/tmp/dl")).await.unwrap();
        repo.update_max_upload_speed(Some(128)).await.unwrap();
        assert_eq!(
            repo.get().await.unwrap().unwrap().max_upload_speed,
            Some(128)
        );
        repo.update_max_upload_speed(None).await.unwrap();
        assert!(repo
            .get()
            .await
            .unwrap()
            .unwrap()
            .max_upload_speed
            .is_none());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_字段更新_行不存在时自动插入默认行() {
        let repo = setup().await;
        // 直接调用字段更新，行不存在时应自动 INSERT
        repo.update_download_dir("/tmp/auto").await.unwrap();
        let loaded = repo.get().await.unwrap().unwrap();
        assert_eq!(loaded.download_dir, "/tmp/auto");
        assert!(loaded.proxy.is_none());
        assert!(loaded.ai_configs.is_none());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_并发字段更新_无数据丢失() {
        let repo = setup().await;
        repo.upsert(&default_settings("/tmp/dl")).await.unwrap();
        // 并发更新不同字段
        let ai_configs = sample_ai_configs();
        let (r1, r2, r3, r4, r5) = tokio::join!(
            repo.update_download_dir("/tmp/concurrent"),
            repo.update_proxy(Some("http://proxy")),
            repo.update_ai_configs(Some(&ai_configs)),
            repo.update_max_download_speed(Some(300)),
            repo.update_max_upload_speed(Some(150))
        );
        r1.unwrap();
        r2.unwrap();
        r3.unwrap();
        r4.unwrap();
        r5.unwrap();
        let loaded = repo.get().await.unwrap().unwrap();
        assert_eq!(loaded.download_dir, "/tmp/concurrent");
        assert_eq!(loaded.proxy.as_deref(), Some("http://proxy"));
        assert_eq!(loaded.ai_configs.unwrap().len(), 1);
        assert_eq!(loaded.max_download_speed, Some(300));
        assert_eq!(loaded.max_upload_speed, Some(150));
    }
}
