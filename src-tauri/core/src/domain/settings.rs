use serde::{Deserialize, Serialize};

use crate::error::CoreError;

/// 翻译配置，序列化为 JSON 存储在 app_settings.translation 列中。
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct TranslationConfig {
    #[serde(default = "default_target_lang")]
    pub target_lang: String,
    #[serde(default = "default_provider")]
    pub provider: TranslationProvider,
    #[serde(default)]
    pub ai_config_alias: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TranslationProvider {
    Google,
    Ai,
}

fn default_target_lang() -> String {
    "zh-CN".to_string()
}

fn default_provider() -> TranslationProvider {
    TranslationProvider::Google
}

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
    #[serde(default)]
    pub translation: Option<TranslationConfig>,
}

/// AI 配置项，序列化为 JSON 存储在 app_settings.ai_configs 列中。
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AiConfig {
    pub alias: String,
    pub api_endpoint: String,
    pub api_key: String,
    pub ai_model: String,
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
    /// 原子更新 translation 配置。
    async fn update_translation_config(
        &self,
        config: Option<&TranslationConfig>,
    ) -> Result<(), CoreError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[allow(non_snake_case)]
    fn 测试_TranslationConfig_序列化与反序列化() {
        let config = TranslationConfig {
            target_lang: "ja".to_string(),
            provider: TranslationProvider::Ai,
            ai_config_alias: Some("gpt".to_string()),
        };
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: TranslationConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config, deserialized);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_TranslationConfig_反序列化时缺失字段使用默认值() {
        let json = "{}";
        let config: TranslationConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.target_lang, "zh-CN");
        assert_eq!(config.provider, TranslationProvider::Google);
        assert!(config.ai_config_alias.is_none());
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_TranslationProvider_序列化为小写() {
        assert_eq!(
            serde_json::to_string(&TranslationProvider::Google).unwrap(),
            "\"google\""
        );
        assert_eq!(
            serde_json::to_string(&TranslationProvider::Ai).unwrap(),
            "\"ai\""
        );
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_TranslationProvider_从小写字符串反序列化() {
        assert_eq!(
            serde_json::from_str::<TranslationProvider>("\"google\"").unwrap(),
            TranslationProvider::Google
        );
        assert_eq!(
            serde_json::from_str::<TranslationProvider>("\"ai\"").unwrap(),
            TranslationProvider::Ai
        );
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_AppSettings_序列化包含translation字段() {
        let settings = AppSettings {
            download_dir: "/tmp/dl".to_string(),
            proxy: None,
            ai_configs: None,
            max_download_speed: None,
            max_upload_speed: None,
            translation: Some(TranslationConfig {
                target_lang: "zh-CN".to_string(),
                provider: TranslationProvider::Google,
                ai_config_alias: None,
            }),
        };
        let json = serde_json::to_value(&settings).unwrap();
        let t = json.get("translation").unwrap();
        assert_eq!(t.get("target_lang").unwrap(), "zh-CN");
        assert_eq!(t.get("provider").unwrap(), "google");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_AppSettings_反序列化时translation缺失默认为None() {
        let json = r#"{"download_dir":"/tmp","proxy":null,"ai_configs":null,"max_download_speed":null,"max_upload_speed":null}"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert!(settings.translation.is_none());
    }
}
