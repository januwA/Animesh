use serde::{Deserialize, Serialize};

use crate::error::CoreError;

/// 应用设置聚合根，对应 app_settings 表的单行记录。
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AppSettings {
    pub download_dir: String,
    pub proxy: Option<String>,
    #[serde(default)]
    pub ai_configs: Option<Vec<AiConfig>>,
    #[serde(default)]
    pub max_download_speed: Option<u32>,
    #[serde(default)]
    pub max_upload_speed: Option<u32>,
}

/// AI 配置项，序列化为 JSON 存储在 app_settings.ai_configs 列中。
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AiConfig {
    pub alias: String,
    pub api_endpoint: String,
    pub api_key: String,
    pub ai_model: Option<String>,
}

/// 设置仓储接口，由基础设施层（SQLite）实现。
///
/// 设计原则：
/// - `get` 读取整行；若未初始化返回 `None`，由调用方决定回退策略。
/// - `upsert` 整行覆盖写入；`ensure_initialized` 仅在行不存在时写入默认值。
/// - `update_*` 方法对应字段级原子 UPDATE，避免 read-modify-write 竞态。
#[async_trait::async_trait]
pub trait SettingsRepository: Send + Sync {
    /// 读取当前设置。若表中无记录返回 `None`。
    async fn get(&self) -> Result<Option<AppSettings>, CoreError>;
    /// 整行覆盖写入（INSERT OR REPLACE）。
    async fn upsert(&self, settings: &AppSettings) -> Result<(), CoreError>;
    /// 若行不存在则插入 `default`，返回当前设置。
    async fn ensure_initialized(&self, default: &AppSettings) -> Result<AppSettings, CoreError>;
    /// 原子更新 download_dir。若行不存在则插入仅含该字段的行。
    async fn update_download_dir(&self, dir: &str) -> Result<(), CoreError>;
    /// 原子更新 proxy。
    async fn update_proxy(&self, proxy: Option<&str>) -> Result<(), CoreError>;
    /// 读取当前 proxy 配置。行不存在时返回 `None`。
    async fn get_proxy(&self) -> Result<Option<String>, CoreError>;
    /// 原子更新 ai_configs。
    async fn update_ai_configs(&self, configs: Option<&[AiConfig]>) -> Result<(), CoreError>;
    /// 原子更新 max_download_speed。
    async fn update_max_download_speed(&self, speed: Option<u32>) -> Result<(), CoreError>;
    /// 原子更新 max_upload_speed。
    async fn update_max_upload_speed(&self, speed: Option<u32>) -> Result<(), CoreError>;
}
