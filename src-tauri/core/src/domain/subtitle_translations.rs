use serde::{Deserialize, Serialize};

use crate::error::CoreError;

/// 一条 AI 字幕翻译记录。
///
/// 对应 `subtitle_translations` 表的一行。主键为 `id`（UUID），
/// 每次翻译都会写入一条新记录，保留历史；同一原始轨道可以有多条
/// 用同一 AI 配置翻译到同一目标语言的记录。
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SubtitleTranslationRecord {
    /// 记录唯一标识（UUID），由前端在保存时生成
    pub id: String,
    pub info_hash: String,
    pub file_id: i64,
    pub original_track_id: i64,
    pub source_lang: String,
    pub target_lang: String,
    /// 翻译后的 VTT 文本
    pub vtt_content: String,
    /// 创建时间（Unix 毫秒）
    pub created_at: i64,
    /// 最后命中时间（Unix 毫秒），用于 LRU 清理参考
    pub last_accessed_at: i64,
}

/// 字幕翻译记录仓储接口，由基础设施层（SQLite）实现。
///
/// 设计原则：
/// - 每次 `save` 都是插入一条新记录（保留翻译历史），不做覆盖。
/// - `get_by_id` 命中时同时更新 `last_accessed_at`，便于未来 LRU 清理。
/// - `list_by_torrent` 返回某一下载任务下的所有翻译记录（不含 vtt_content），
///   供前端在进入播放器时一次性加载所有可用 AI 轨道。
/// - `delete_by_id` 由用户主动触发，不在翻译流程中自动调用。
#[async_trait::async_trait]
pub trait SubtitleTranslationRepository: Send + Sync {
    /// 按 UUID 查询记录。命中时返回完整记录（含 vtt_content），并更新 last_accessed_at。
    /// 未命中返回 None。
    async fn get_by_id(&self, id: &str) -> Result<Option<SubtitleTranslationRecord>, CoreError>;

    /// 列出指定种子+文件下的所有翻译记录（不含 vtt_content，避免传输过大）。
    /// 返回的记录中 vtt_content 为空字符串。
    async fn list_by_torrent(
        &self,
        info_hash: &str,
        file_id: i64,
    ) -> Result<Vec<SubtitleTranslationRecord>, CoreError>;

    /// 保存（INSERT）一条翻译记录。每次调用都写入一条新记录，保留历史。
    async fn save(&self, record: &SubtitleTranslationRecord) -> Result<(), CoreError>;

    /// 删除指定 UUID 的记录。返回是否实际删除了一行。
    async fn delete_by_id(&self, id: &str) -> Result<bool, CoreError>;

    /// 删除指定种子+文件下的所有翻译缓存。返回实际删除的行数。
    async fn delete_by_torrent(&self, info_hash: &str, file_id: i64) -> Result<u64, CoreError>;

    /// 删除指定种子 info_hash 下所有文件、所有轨道、所有语言、所有 AI 配置的翻译缓存。
    /// 用于删除整个下载任务时一并清理。返回实际删除的行数。
    async fn delete_by_info_hash(&self, info_hash: &str) -> Result<u64, CoreError>;
}
