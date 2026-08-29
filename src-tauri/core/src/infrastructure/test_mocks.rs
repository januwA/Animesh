//! 共享测试 mock 实现。
//!
//! 放在 `infrastructure/` 下是因为覆盖率报告通过 `--ignore-filename-regex "infrastructure"`
//! 排除了本目录,避免未调用的 mock trait 方法拉低函数覆盖率。各服务测试模块通过
//! `use crate::infrastructure::test_mocks::*` 引入,无需各自重复实现完整 trait。

#![cfg(test)]

use crate::domain::crawler::{CrawlerRepository, SearchResultItem};
use crate::domain::settings::{AiConfig, AppSettings, SettingsRepository, TranslationConfig};
use crate::domain::stream::{StreamKind, StreamProber};
use crate::domain::subtitles::{SubtitleCache, SubtitleExtractor, VideoInfo, VideoMetadata};
use crate::domain::torrent::{
    AddTorrentResult, AsyncReadSeek, FileDetails, SubjectBinding, SubjectBindingRepository,
    TorrentRepository, TorrentStatusInfo,
};
use crate::error::{CoreError, CoreResult};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

// ============================================================================
// MockTorrentRepository
// ============================================================================

/// 可配置的 `TorrentRepository` 测试替身。
///
/// 所有调用记录存储在 `Arc<Mutex<...>>` 中,可在多任务间共享。
/// 通过 `Default` 创建空壳,再按需设置字段。
#[derive(Clone)]
pub struct MockTorrentRepository {
    pub files: Option<Vec<FileDetails>>,
    pub status: Option<TorrentStatusInfo>,
    pub add_result: CoreResult<AddTorrentResult>,
    pub max_download_speed_calls: Arc<Mutex<Vec<Option<u32>>>>,
    pub max_upload_speed_calls: Arc<Mutex<Vec<Option<u32>>>>,
}

impl Default for MockTorrentRepository {
    fn default() -> Self {
        Self {
            files: None,
            status: None,
            add_result: Err("未配置".to_string().into()),
            max_download_speed_calls: Arc::new(Mutex::new(vec![])),
            max_upload_speed_calls: Arc::new(Mutex::new(vec![])),
        }
    }
}

impl MockTorrentRepository {
    pub fn with_files(mut self, files: Vec<FileDetails>) -> Self {
        self.files = Some(files);
        self
    }

    pub fn with_status(mut self, status: TorrentStatusInfo) -> Self {
        self.status = Some(status);
        self
    }

    pub fn with_add_result(mut self, result: CoreResult<AddTorrentResult>) -> Self {
        self.add_result = result;
        self
    }
}

#[async_trait::async_trait]
impl TorrentRepository for MockTorrentRepository {
    async fn add_magnet(&self, _magnet: &str) -> CoreResult<AddTorrentResult> {
        self.add_result.clone()
    }
    async fn list_torrents(&self) -> Vec<TorrentStatusInfo> {
        self.status.clone().into_iter().collect()
    }
    async fn pause_torrent(&self, _info_hash: &str) -> CoreResult<()> {
        Ok(())
    }
    async fn resume_torrent(&self, _info_hash: &str) -> CoreResult<()> {
        Ok(())
    }
    async fn delete_torrent(&self, _info_hash: &str, _delete_files: bool) -> CoreResult<()> {
        Ok(())
    }
    async fn get_torrent_files(&self, _info_hash: &str) -> Option<Vec<FileDetails>> {
        self.files.clone()
    }
    async fn get_file_reader(
        &self,
        _info_hash: &str,
        _file_id: usize,
    ) -> Result<Box<dyn AsyncReadSeek>, CoreError> {
        Err("未配置读取器".to_string().into())
    }
    async fn set_max_download_speed(&self, bytes_per_sec: Option<u32>) {
        self.max_download_speed_calls
            .lock()
            .unwrap()
            .push(bytes_per_sec);
    }
    async fn set_max_upload_speed(&self, bytes_per_sec: Option<u32>) {
        self.max_upload_speed_calls
            .lock()
            .unwrap()
            .push(bytes_per_sec);
    }
}

// ============================================================================
// MockSubjectBindingRepository
// ============================================================================

/// 可配置的 `SubjectBindingRepository` 测试替身。
#[derive(Default, Clone)]
pub struct MockSubjectBindingRepository {
    pub get_result: Option<SubjectBinding>,
    pub set_calls: Arc<Mutex<Vec<(String, u64, String, String)>>>,
    pub cleared: Arc<Mutex<Vec<(String, String)>>>,
    pub cleared_all: Arc<Mutex<Vec<String>>>,
}

#[async_trait::async_trait]
impl SubjectBindingRepository for MockSubjectBindingRepository {
    async fn get(&self, _info_hash: &str, _platform: &str) -> Option<SubjectBinding> {
        self.get_result.clone()
    }
    async fn set(&self, info_hash: &str, binding: SubjectBinding) {
        self.set_calls.lock().unwrap().push((
            info_hash.to_string(),
            binding.subject_id,
            binding.platform,
            binding.subject_name,
        ));
    }
    async fn clear(&self, info_hash: &str, platform: &str) {
        self.cleared
            .lock()
            .unwrap()
            .push((info_hash.to_string(), platform.to_string()));
    }
    async fn clear_all(&self, info_hash: &str) {
        self.cleared_all.lock().unwrap().push(info_hash.to_string());
    }
}

impl MockSubjectBindingRepository {
    pub fn with_get_result(mut self, result: SubjectBinding) -> Self {
        self.get_result = Some(result);
        self
    }
}

// ============================================================================
// MockSubtitleCache
// ============================================================================

/// 可配置的 `SubtitleCache` 测试替身。
#[derive(Default, Clone)]
pub struct MockSubtitleCache {
    pub vtt_result: Option<String>,
    pub failure_result: Option<String>,
    pub set_vtt_calls: Arc<Mutex<usize>>,
    pub set_failure_calls: Arc<Mutex<usize>>,
}

#[async_trait::async_trait]
impl SubtitleCache for MockSubtitleCache {
    async fn get_vtt(
        &self,
        _info_hash: &str,
        _file_id: usize,
        _track_id: u64,
        _file_path: &Path,
    ) -> Option<String> {
        self.vtt_result.clone()
    }
    async fn set_vtt(
        &self,
        _info_hash: &str,
        _file_id: usize,
        _track_id: u64,
        _file_path: &Path,
        _data: String,
    ) {
        *self.set_vtt_calls.lock().unwrap() += 1;
    }
    async fn set_failure(
        &self,
        _key: &str,
        _file_path: &Path,
        _error: String,
        _now: Option<SystemTime>,
    ) {
        *self.set_failure_calls.lock().unwrap() += 1;
    }
    async fn get_failure(
        &self,
        _key: &str,
        _file_path: &Path,
        _now: Option<SystemTime>,
    ) -> Option<String> {
        self.failure_result.clone()
    }
}

// ============================================================================
// MockSubtitleExtractor
// ============================================================================

/// 可配置的 `SubtitleExtractor` 测试替身。
pub struct MockSubtitleExtractor {
    pub metadata_result: CoreResult<VideoMetadata>,
    pub vtt_result: CoreResult<String>,
}

impl MockSubtitleExtractor {
    /// 返回成功结果的提取器(空元数据 + "WEBVTT\n" 字幕)。
    pub fn ok() -> Self {
        Self {
            metadata_result: Ok(VideoMetadata {
                tracks: vec![],
                chapters: vec![],
                video_info: VideoInfo {
                    date_utc: None,
                    muxing_app: String::new(),
                    writing_app: String::new(),
                    video_tracks: vec![],
                    audio_tracks: vec![],
                },
            }),
            vtt_result: Ok("WEBVTT\n".to_string()),
        }
    }
}

#[async_trait::async_trait]
impl SubtitleExtractor for MockSubtitleExtractor {
    async fn extract_video_metadata(&self, _path: &Path) -> CoreResult<VideoMetadata> {
        self.metadata_result.clone()
    }
    async fn extract_subtitle_vtt(&self, _path: &Path, _track_id: u64) -> CoreResult<String> {
        self.vtt_result.clone()
    }
}

// ============================================================================
// MockStreamProber
// ============================================================================

/// 返回固定 `StreamKind` 的 `StreamProber` 测试替身。
pub struct MockStreamProber(pub StreamKind);

#[async_trait::async_trait]
impl StreamProber for MockStreamProber {
    async fn probe(&self, _raw_url: &str) -> StreamKind {
        self.0
    }
}

// ============================================================================
// MockCrawlerRepository
// ============================================================================

/// 按引擎返回固定结果的 `CrawlerRepository` 测试替身。
#[derive(Default)]
pub struct MockCrawlerRepository;

fn make_item(engine: &str) -> SearchResultItem {
    SearchResultItem {
        title: format!("{engine}-条目"),
        link: String::new(),
        pub_date: String::new(),
        magnet: String::new(),
        description: String::new(),
    }
}

#[async_trait::async_trait]
impl CrawlerRepository for MockCrawlerRepository {
    async fn search_dmhy(
        &self,
        _keyword: &str,
        _proxy: Option<String>,
    ) -> CoreResult<Vec<SearchResultItem>> {
        Ok(vec![make_item("dmhy")])
    }
    async fn search_bangumi_moe(
        &self,
        _keyword: &str,
        _proxy: Option<String>,
    ) -> CoreResult<Vec<SearchResultItem>> {
        Ok(vec![make_item("bangumi_moe")])
    }
    async fn search_mikan(
        &self,
        _keyword: &str,
        _proxy: Option<String>,
    ) -> CoreResult<Vec<SearchResultItem>> {
        Ok(vec![make_item("mikan")])
    }
    async fn search_nyaa(
        &self,
        _keyword: &str,
        _proxy: Option<String>,
    ) -> CoreResult<Vec<SearchResultItem>> {
        Ok(vec![make_item("nyaa")])
    }
    async fn search_acgrip(
        &self,
        _keyword: &str,
        _proxy: Option<String>,
    ) -> CoreResult<Vec<SearchResultItem>> {
        Ok(vec![make_item("acgrip")])
    }
    async fn search_anibt(
        &self,
        _keyword: &str,
        _proxy: Option<String>,
    ) -> CoreResult<Vec<SearchResultItem>> {
        Ok(vec![make_item("anibt")])
    }
}

// ============================================================================
// MockSettingsRepository
// ============================================================================

/// 可配置的 `SettingsRepository` 测试替身。
#[derive(Default, Clone)]
pub struct MockSettingsRepository {
    pub proxy: Option<String>,
    pub get_proxy_error: Option<String>,
    pub post_error: Option<String>,
}

#[async_trait::async_trait]
impl SettingsRepository for MockSettingsRepository {
    async fn get(&self) -> Result<Option<AppSettings>, CoreError> {
        Ok(None)
    }
    async fn upsert(&self, _settings: &AppSettings) -> Result<(), CoreError> {
        Ok(())
    }
    async fn ensure_initialized(&self, _default: &AppSettings) -> Result<AppSettings, CoreError> {
        unimplemented!()
    }
    async fn update_download_dir(&self, _dir: &str) -> Result<(), CoreError> {
        unimplemented!()
    }
    async fn update_proxy(&self, _proxy: Option<&str>) -> Result<(), CoreError> {
        unimplemented!()
    }
    async fn get_proxy(&self) -> Result<Option<String>, CoreError> {
        if let Some(err) = &self.get_proxy_error {
            return Err(CoreError::Message(err.clone()));
        }
        Ok(self.proxy.clone())
    }
    async fn update_ai_configs(&self, _configs: Option<&[AiConfig]>) -> Result<(), CoreError> {
        unimplemented!()
    }
    async fn update_max_download_speed(&self, _speed: Option<u32>) -> Result<(), CoreError> {
        unimplemented!()
    }
    async fn update_max_upload_speed(&self, _speed: Option<u32>) -> Result<(), CoreError> {
        unimplemented!()
    }
    async fn update_translation_config(
        &self,
        _config: Option<&TranslationConfig>,
    ) -> Result<(), CoreError> {
        unimplemented!()
    }
}

// ============================================================================
// 辅助函数
// ============================================================================

/// 创建唯一的临时测试目录。
pub fn temp_dir(label: &str) -> std::path::PathBuf {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("animesh_test_{}_{}", label, nanos))
}

/// 在指定目录下写入测试文件。
pub fn write_test_file(dir: &Path, name: &str, data: &[u8]) {
    std::fs::create_dir_all(dir).unwrap();
    std::fs::write(dir.join(name), data).unwrap();
}
