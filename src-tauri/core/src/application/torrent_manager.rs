use crate::domain::crawler::{CrawlerRepository, SearchResultItem};
use crate::domain::settings::SettingsRepository;
use crate::domain::stream::{proxy_base_url, ResolvedStream, StreamProber};
use crate::domain::subtitles::{SubtitleCache, SubtitleExtractor, VideoMetadata};
use crate::domain::torrent::{AddTorrentResult, FileDetails, TorrentRepository, TorrentStatusInfo};
use crate::error::{CoreError, CoreResult};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;

// 领域模型 AppSettings / AiConfig 已迁移至 domain::settings，这里重新导出以保持公共 API 稳定。
pub use crate::domain::settings::{AiConfig, AppSettings};

/// 种子下载与流媒体领域用例。
/// 所有外部依赖（种子仓储、爬虫、字幕缓存/提取、流探测、设置仓储）均通过构造注入，便于替换与测试。
pub struct TorrentManager {
    torrent_repo: Arc<dyn TorrentRepository>,
    crawler_repo: Arc<dyn CrawlerRepository>,
    subtitle_cache: Arc<dyn SubtitleCache>,
    subtitle_extractor: Arc<dyn SubtitleExtractor>,
    stream_prober: Arc<dyn StreamProber>,
    settings_repo: Arc<dyn SettingsRepository>,
    pub port: u16,
    download_dir: Arc<RwLock<PathBuf>>,
    proxy: Arc<RwLock<Option<String>>>,
}

impl TorrentManager {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        download_dir: Arc<RwLock<PathBuf>>,
        proxy: Option<String>,
        port: u16,
        torrent_repo: Arc<dyn TorrentRepository>,
        crawler_repo: Arc<dyn CrawlerRepository>,
        subtitle_cache: Arc<dyn SubtitleCache>,
        subtitle_extractor: Arc<dyn SubtitleExtractor>,
        stream_prober: Arc<dyn StreamProber>,
        settings_repo: Arc<dyn SettingsRepository>,
    ) -> Self {
        Self {
            torrent_repo,
            crawler_repo,
            subtitle_cache,
            subtitle_extractor,
            stream_prober,
            settings_repo,
            port,
            download_dir,
            proxy: Arc::new(RwLock::new(proxy)),
        }
    }

    /// 异步初始化方法，应用初始速度限制。
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
        self.download_dir
            .read()
            .unwrap()
            .to_string_lossy()
            .to_string()
    }

    pub async fn set_download_dir(&self, dir: String) -> CoreResult<()> {
        let path = PathBuf::from(&dir);
        tokio::fs::create_dir_all(&path).await?;

        self.settings_repo.update_download_dir(&dir).await?;

        *self.download_dir.write().unwrap() = path;
        Ok(())
    }

    pub async fn get_proxy(&self) -> Option<String> {
        self.proxy.read().unwrap().clone()
    }

    pub async fn set_proxy(&self, proxy: Option<String>) -> CoreResult<()> {
        self.settings_repo.update_proxy(proxy.as_deref()).await?;

        *self.proxy.write().unwrap() = proxy;
        Ok(())
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
            }),
        }
    }

    pub async fn set_ai_configs(&self, configs: Option<Vec<AiConfig>>) -> CoreResult<()> {
        self.settings_repo
            .update_ai_configs(configs.as_deref())
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

    pub async fn pause_torrent(&self, info_hash_hex: &str) -> CoreResult<()> {
        self.torrent_repo.pause_torrent(info_hash_hex).await
    }

    pub async fn resume_torrent(&self, info_hash_hex: &str) -> CoreResult<()> {
        self.torrent_repo.resume_torrent(info_hash_hex).await
    }

    pub async fn delete_torrent(&self, info_hash_hex: &str, delete_files: bool) -> CoreResult<()> {
        self.torrent_repo
            .delete_torrent(info_hash_hex, delete_files)
            .await
    }

    pub async fn list_torrents(&self) -> Vec<TorrentStatusInfo> {
        self.torrent_repo.list_torrents().await
    }

    pub async fn set_subject_binding(
        &self,
        info_hash: &str,
        subject_id: u64,
        subject_name: String,
    ) {
        self.torrent_repo
            .set_subject_binding(info_hash, subject_id, subject_name)
            .await;
    }

    pub async fn clear_subject_binding(&self, info_hash: &str) {
        self.torrent_repo.clear_subject_binding(info_hash).await;
    }

    pub async fn add_magnet(&self, magnet: &str) -> CoreResult<AddTorrentResult> {
        self.torrent_repo.add_magnet(magnet).await
    }

    pub async fn get_torrent_status(&self, info_hash_hex: &str) -> Option<TorrentStatusInfo> {
        self.torrent_repo.get_torrent_status(info_hash_hex).await
    }

    pub async fn get_torrent_files(&self, info_hash_hex: &str) -> Option<Vec<FileDetails>> {
        self.torrent_repo.get_torrent_files(info_hash_hex).await
    }

    /// 按引擎分发搜索请求，返回搜索结果。
    pub async fn search(&self, engine: &str, keyword: &str) -> CoreResult<Vec<SearchResultItem>> {
        let proxy = self.get_proxy().await;
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

    /// 提取视频元数据（字幕轨道、媒体信息、章节）。
    pub async fn get_video_metadata(
        &self,
        info_hash: &str,
        file_id: usize,
    ) -> CoreResult<VideoMetadata> {
        let download_dir = self.get_download_dir().await;
        let files = self
            .get_torrent_files(info_hash)
            .await
            .ok_or(CoreError::TorrentNotFound)?;
        let file_details = files
            .iter()
            .find(|f| f.id == file_id)
            .ok_or(CoreError::FileNotFound)?;

        let path = PathBuf::from(download_dir).join(&file_details.name);
        if !path.exists() {
            return Err(CoreError::VideoNotDownloaded);
        }
        if !file_details.name.to_lowercase().ends_with(".mkv") {
            return Err(CoreError::UnsupportedVideoFormat);
        }

        self.subtitle_extractor.extract_video_metadata(&path).await
    }

    /// 提取字幕 VTT。命中缓存直接返回；失败带冷却，避免下载未完成时反复读取整个 MKV。
    pub async fn get_subtitle_vtt(
        &self,
        info_hash: &str,
        file_id: usize,
        track_id: u64,
    ) -> CoreResult<String> {
        let download_dir = self.get_download_dir().await;
        let files = self
            .get_torrent_files(info_hash)
            .await
            .ok_or(CoreError::TorrentNotFound)?;
        let file_details = files
            .iter()
            .find(|f| f.id == file_id)
            .ok_or(CoreError::FileNotFound)?;

        let path = PathBuf::from(download_dir).join(&file_details.name);
        if !path.exists() {
            return Err(CoreError::VideoNotDownloaded);
        }

        let cache = self.subtitle_cache.clone();
        let cache_path = path.clone();
        let failure_key = format!("{}:{}:{}", info_hash, file_id, track_id);
        if let Some(error) = cache.get_failure(&failure_key, &cache_path, None).await {
            return Err(CoreError::Message(error));
        }
        if let Some(vtt) = cache
            .get_vtt(info_hash, file_id, track_id, &cache_path)
            .await
        {
            return Ok(vtt);
        }

        let extractor = self.subtitle_extractor.clone();
        let path_for_parse = path.clone();
        let parse = async move {
            extractor
                .extract_subtitle_vtt(&path_for_parse, track_id)
                .await
        };
        match tokio::time::timeout(Duration::from_secs(15), parse).await {
            Ok(Ok(vtt)) => {
                cache
                    .set_vtt(info_hash, file_id, track_id, &cache_path, vtt.clone())
                    .await;
                Ok(vtt)
            }
            Ok(Err(e)) => {
                cache
                    .set_failure(&failure_key, &cache_path, e.to_string(), None)
                    .await;
                Err(e)
            }
            Err(_) => {
                let message = CoreError::SubtitleParseTimeout;
                cache
                    .set_failure(&failure_key, &cache_path, message.to_string(), None)
                    .await;
                Err(message)
            }
        }
    }

    /// 探测直播源类型并返回可直接播放的代理地址。
    pub async fn resolve_stream(&self, raw_url: &str) -> CoreResult<ResolvedStream> {
        let kind = self.stream_prober.probe(raw_url).await;
        Ok(ResolvedStream {
            proxy_url: proxy_base_url(self.port),
            kind,
        })
    }

    /// 生成对前端公开的 IPTV 代理基础地址。
    pub async fn proxy_base_url(&self) -> String {
        proxy_base_url(self.port)
    }

    pub async fn get_stream_url(&self, info_hash_hex: &str, file_id: usize) -> String {
        let host = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
        format!(
            "http://{}:{}/stream/{}/{}",
            host, self.port, info_hash_hex, file_id
        )
    }
}

/// 将 KB/s 限速值转换为 bytes/s，0 或 None 表示不限速。
fn speed_kbps_to_bytes_per_sec(speed_kbps: Option<u32>) -> Option<u32> {
    speed_kbps.and_then(|kbps| {
        if kbps == 0 {
            None
        } else {
            Some(kbps.saturating_mul(1024))
        }
    })
}

fn select_best_local_ip(interfaces: Vec<(String, std::net::IpAddr)>) -> Option<String> {
    use std::net::IpAddr;

    let mut best_ip: Option<(String, i32)> = None;

    for (name, ip) in interfaces {
        let ipv4 = match ip {
            IpAddr::V4(v4) => v4,
            _ => continue, // Ignore IPv6 for stream URL compatibility
        };

        // 回环、未指定以及链路本地地址(169.254.x.x / APIPA)均不适合作为流地址，
        // APIPA 是网卡拿不到 DHCP 时的临时地址，随时会失效导致 URL 不可达
        if ipv4.is_loopback() || ipv4.is_unspecified() {
            continue;
        }

        let octets = ipv4.octets();
        let is_link_local = octets[0] == 169 && octets[1] == 254;
        if is_link_local {
            continue;
        }

        let name_lower = name.to_lowercase();
        let mut score = 0;

        let is_private = (octets[0] == 10)
            || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
            || (octets[0] == 192 && octets[1] == 168);

        if is_private {
            score += 10;
        }

        let ignore_keywords = [
            "virtual",
            "vbox",
            "vmware",
            "virtualbox",
            "hyper-v",
            "wsl",
            "veth",
            "vethernet",
            "xray",
            "tun",
            "tap",
            "tailscale",
            "zerotier",
            "vpn",
            "ppp",
            "docker",
            "loopback",
        ];

        if ignore_keywords.iter().any(|&kw| name_lower.contains(kw)) {
            score -= 100;
        }

        let wifi_keywords = ["wlan", "wifi", "wi-fi", "wireless", "无线"];
        let ethernet_keywords = ["ethernet", "eth", "以太网", "本地连接", "lan"];

        if wifi_keywords.iter().any(|&kw| name_lower.contains(kw)) {
            score += 50;
        } else if ethernet_keywords.iter().any(|&kw| name_lower.contains(kw)) {
            score += 30;
        }

        let ip_str = ipv4.to_string();
        match &best_ip {
            Some((_, best_score)) => {
                if score > *best_score {
                    best_ip = Some((ip_str, score));
                }
            }
            None => {
                best_ip = Some((ip_str, score));
            }
        }
    }

    // 只返回真实可达的物理网卡地址；虚拟网卡(xray/Tailscale/WSL 等)优先级过低，
    // 若没有更好的候选则视为无可用地址，交由调用方回退到 127.0.0.1
    match best_ip {
        Some((ip, score)) if score >= 0 => Some(ip),
        _ => None,
    }
}

fn get_local_ip() -> Option<String> {
    use local_ip_address::list_afinet_netifas;

    if let Ok(interfaces) = list_afinet_netifas() {
        if let Some(ip) = select_best_local_ip(interfaces) {
            return Some(ip);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::stream::StreamKind;
    use crate::domain::subtitles::VideoInfo;
    use crate::domain::torrent::AsyncReadSeek;
    use crate::infrastructure::db::AppDatabase;
    use crate::infrastructure::hls_proxy::HlsProxyState;
    use crate::infrastructure::matroska_subtitles::MatroskaSubtitleExtractor;
    use crate::infrastructure::rqbit_torrent::create_torrent_repository;
    use crate::infrastructure::settings_repository::SqliteSettingsRepository;
    use crate::infrastructure::stream_server::{build_stream_router, StreamState};
    use crate::infrastructure::subtitle_cache::InMemorySubtitleCache;
    use axum::body::Body;
    use std::path::{Path, PathBuf};
    use std::time::SystemTime;

    /// 构造一个使用真实基础设施（内存 SQLite + 真实 librqbit 会话）的测试管理器。
    async fn build_manager(
        dir: PathBuf,
    ) -> CoreResult<(TorrentManager, Arc<dyn TorrentRepository>)> {
        let download_dir_lock: Arc<RwLock<PathBuf>> = Arc::new(RwLock::new(dir.clone()));
        let db = Arc::new(
            AppDatabase::connect_in_memory()
                .await
                .expect("内存库应成功"),
        );
        let persistence_dir = dir.join(".torrents");
        let torrent_repo =
            create_torrent_repository(download_dir_lock.clone(), persistence_dir, &db).await?;
        let crawler_repo = crate::infrastructure::http_crawler::create_crawler_repository();
        let subtitle_cache: Arc<dyn SubtitleCache> = Arc::new(InMemorySubtitleCache::new());
        let subtitle_extractor: Arc<dyn SubtitleExtractor> = Arc::new(MatroskaSubtitleExtractor);
        let stream_prober: Arc<dyn StreamProber> = Arc::new(HlsProxyState::new(proxy_base_url(0)));
        let settings_repo: Arc<dyn SettingsRepository> =
            Arc::new(SqliteSettingsRepository::new(&db));

        let manager = TorrentManager::new(
            download_dir_lock,
            None,
            45678,
            torrent_repo.clone(),
            crawler_repo,
            subtitle_cache,
            subtitle_extractor,
            stream_prober,
            settings_repo,
        );
        Ok((manager, torrent_repo))
    }

    fn temp_dir(label: &str) -> PathBuf {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("animesh_test_{}_{}", label, nanos))
    }

    // --- 测试替身 ---

    struct MockTorrentRepository {
        files: Option<Vec<FileDetails>>,
        status: Option<TorrentStatusInfo>,
        add_result: CoreResult<AddTorrentResult>,
        subject_bindings: Arc<std::sync::Mutex<Vec<(String, u64, String)>>>,
        cleared: Arc<std::sync::Mutex<Vec<String>>>,
    }

    impl Default for MockTorrentRepository {
        fn default() -> Self {
            Self {
                files: None,
                status: None,
                add_result: Err("未配置".to_string().into()),
                subject_bindings: Arc::new(std::sync::Mutex::new(Vec::new())),
                cleared: Arc::new(std::sync::Mutex::new(Vec::new())),
            }
        }
    }

    #[async_trait::async_trait]
    impl TorrentRepository for MockTorrentRepository {
        async fn add_magnet(&self, _magnet: &str) -> CoreResult<AddTorrentResult> {
            self.add_result.clone()
        }
        async fn get_torrent_status(&self, _info_hash: &str) -> Option<TorrentStatusInfo> {
            self.status.clone()
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
        async fn set_max_download_speed(&self, _bytes_per_sec: Option<u32>) {}
        async fn set_max_upload_speed(&self, _bytes_per_sec: Option<u32>) {}
        async fn set_subject_binding(
            &self,
            info_hash: &str,
            subject_id: u64,
            subject_name: String,
        ) {
            self.subject_bindings.lock().unwrap().push((
                info_hash.to_string(),
                subject_id,
                subject_name,
            ));
        }
        async fn clear_subject_binding(&self, info_hash: &str) {
            self.cleared.lock().unwrap().push(info_hash.to_string());
        }
    }

    fn make_item(engine: &str) -> SearchResultItem {
        SearchResultItem {
            title: format!("{engine}-条目"),
            link: String::new(),
            pub_date: String::new(),
            magnet: String::new(),
            description: String::new(),
        }
    }

    #[derive(Default)]
    struct MockCrawlerRepository;

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

    #[derive(Default)]
    struct MockSubtitleCache {
        vtt_result: Option<String>,
        failure_result: Option<String>,
        set_vtt_calls: Arc<std::sync::Mutex<usize>>,
        set_failure_calls: Arc<std::sync::Mutex<usize>>,
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

    struct MockSubtitleExtractor {
        metadata_result: CoreResult<VideoMetadata>,
        vtt_result: CoreResult<String>,
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

    struct MockStreamProber(StreamKind);

    #[async_trait::async_trait]
    impl StreamProber for MockStreamProber {
        async fn probe(&self, _raw_url: &str) -> StreamKind {
            self.0
        }
    }

    fn ok_extractor() -> MockSubtitleExtractor {
        MockSubtitleExtractor {
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

    async fn build_manager_custom_with_dir(
        download_dir: PathBuf,
        torrent_repo: Arc<dyn TorrentRepository>,
        crawler_repo: Arc<dyn CrawlerRepository>,
        subtitle_cache: Arc<dyn SubtitleCache>,
        subtitle_extractor: Arc<dyn SubtitleExtractor>,
    ) -> TorrentManager {
        std::fs::create_dir_all(&download_dir).unwrap();
        let download_dir_lock = Arc::new(RwLock::new(download_dir));
        let stream_prober = Arc::new(MockStreamProber(StreamKind::Hls)) as Arc<dyn StreamProber>;
        let db = AppDatabase::connect_in_memory()
            .await
            .expect("内存库应成功");
        let settings_repo: Arc<dyn SettingsRepository> =
            Arc::new(SqliteSettingsRepository::new(&db));
        TorrentManager::new(
            download_dir_lock,
            None,
            45679,
            torrent_repo,
            crawler_repo,
            subtitle_cache,
            subtitle_extractor,
            stream_prober,
            settings_repo,
        )
    }

    async fn build_manager_custom(
        torrent_repo: Arc<dyn TorrentRepository>,
        crawler_repo: Arc<dyn CrawlerRepository>,
        subtitle_cache: Arc<dyn SubtitleCache>,
        subtitle_extractor: Arc<dyn SubtitleExtractor>,
    ) -> TorrentManager {
        build_manager_custom_with_dir(
            temp_dir("manager_custom"),
            torrent_repo,
            crawler_repo,
            subtitle_cache,
            subtitle_extractor,
        )
        .await
    }

    fn write_test_file(dir: &Path, name: &str, data: &[u8]) {
        std::fs::create_dir_all(dir).unwrap();
        std::fs::write(dir.join(name), data).unwrap();
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_搜索_各引擎分发与未知引擎报错() {
        let crawler: Arc<dyn CrawlerRepository> = Arc::new(MockCrawlerRepository);
        let extractor = ok_extractor();
        let manager = build_manager_custom(
            Arc::new(MockTorrentRepository::default()),
            crawler,
            Arc::new(MockSubtitleCache::default()),
            Arc::new(extractor),
        )
        .await;

        for (engine, expected_title) in [
            ("dmhy", "dmhy-条目"),
            ("bangumi_moe", "bangumi_moe-条目"),
            ("mikan", "mikan-条目"),
            ("nyaa", "nyaa-条目"),
            ("acgrip", "acgrip-条目"),
            ("anibt", "anibt-条目"),
        ] {
            let items = manager.search(engine, "关键词").await.expect("搜索应成功");
            assert_eq!(items.len(), 1);
            assert_eq!(items[0].title, expected_title);
        }

        let err = manager.search("unknown", "关键词").await;
        assert!(err
            .unwrap_err()
            .to_string()
            .contains("Unsupported search engine"));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_添加磁力链接_委托仓储并返回结果() {
        let extractor = ok_extractor();
        let repo = MockTorrentRepository {
            add_result: Ok(AddTorrentResult {
                info_hash: "abc123".to_string(),
                name: "示例资源".to_string(),
                files: vec![FileDetails {
                    id: 0,
                    name: "a.mkv".to_string(),
                    len: 1024,
                }],
            }),
            ..Default::default()
        };
        let manager = build_manager_custom(
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(extractor),
        )
        .await;

        let res = manager.add_magnet("magnet:?xt=urn:btih:abc").await;
        let res = res.expect("添加应成功");
        assert_eq!(res.info_hash, "abc123");
        assert_eq!(res.files.len(), 1);

        let repo_err = MockTorrentRepository {
            add_result: Err("添加失败".to_string().into()),
            ..Default::default()
        };
        let manager_err = build_manager_custom(
            Arc::new(repo_err),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;
        assert!(manager_err.add_magnet("magnet").await.is_err());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_设置与清除条目绑定_委托仓储() {
        let repo = Arc::new(MockTorrentRepository::default());
        let bindings = repo.subject_bindings.clone();
        let cleared = repo.cleared.clone();
        let manager = build_manager_custom(
            repo,
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;

        manager
            .set_subject_binding("hash1", 42, "进击的巨人".to_string())
            .await;
        manager.clear_subject_binding("hash1").await;

        assert_eq!(bindings.lock().unwrap().len(), 1);
        assert_eq!(bindings.lock().unwrap()[0].1, 42);
        assert_eq!(*cleared.lock().unwrap(), vec!["hash1".to_string()]);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_获取视频元数据_各分支() {
        // 种子不存在
        let manager = build_manager_custom(
            Arc::new(MockTorrentRepository::default()),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;
        assert!(manager
            .get_video_metadata("h", 0)
            .await
            .unwrap_err()
            .to_string()
            .contains("Torrent not found"));

        // 文件不存在
        let repo = MockTorrentRepository {
            files: Some(vec![]),
            ..Default::default()
        };
        let manager = build_manager_custom(
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;
        assert!(manager
            .get_video_metadata("h", 0)
            .await
            .unwrap_err()
            .to_string()
            .contains("File not found"));

        // 文件未下载
        let dir = temp_dir("metadata_not_downloaded");
        let repo = MockTorrentRepository {
            files: Some(vec![FileDetails {
                id: 0,
                name: "a.mkv".to_string(),
                len: 10,
            }]),
            ..Default::default()
        };
        let manager = build_manager_custom_with_dir(
            dir.clone(),
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;
        assert!(manager
            .get_video_metadata("h", 0)
            .await
            .unwrap_err()
            .to_string()
            .contains("not downloaded"));

        // 非 MKV 格式
        write_test_file(&dir, "a.mp4", b"data");
        let repo = MockTorrentRepository {
            files: Some(vec![FileDetails {
                id: 0,
                name: "a.mp4".to_string(),
                len: 10,
            }]),
            ..Default::default()
        };
        let manager = build_manager_custom_with_dir(
            dir.clone(),
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;
        assert!(manager
            .get_video_metadata("h", 0)
            .await
            .unwrap_err()
            .to_string()
            .contains("Unsupported video format"));

        // 成功提取（mock extractor 返回元数据）
        let repo = MockTorrentRepository {
            files: Some(vec![FileDetails {
                id: 0,
                name: "a.mkv".to_string(),
                len: 10,
            }]),
            ..Default::default()
        };
        write_test_file(&dir, "a.mkv", b"data");
        let manager = build_manager_custom_with_dir(
            dir,
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;
        let metadata = manager
            .get_video_metadata("h", 0)
            .await
            .expect("提取应成功");
        assert!(metadata.tracks.is_empty());

        // 提取失败透传错误
        let extractor_err = MockSubtitleExtractor {
            metadata_result: Err("提取失败".to_string().into()),
            vtt_result: Ok("WEBVTT\n".to_string()),
        };
        let dir2 = temp_dir("metadata_err");
        write_test_file(&dir2, "a.mkv", b"data");
        let repo = MockTorrentRepository {
            files: Some(vec![FileDetails {
                id: 0,
                name: "a.mkv".to_string(),
                len: 10,
            }]),
            ..Default::default()
        };
        let manager = build_manager_custom_with_dir(
            dir2,
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(extractor_err),
        )
        .await;
        assert!(manager
            .get_video_metadata("h", 0)
            .await
            .unwrap_err()
            .to_string()
            .contains("提取失败"));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_提取字幕VTT_缓存与错误处理() {
        // 种子不存在
        let manager = build_manager_custom(
            Arc::new(MockTorrentRepository::default()),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;
        assert!(manager
            .get_subtitle_vtt("h", 0, 1)
            .await
            .unwrap_err()
            .to_string()
            .contains("Torrent not found"));

        // 文件不存在
        let repo = MockTorrentRepository {
            files: Some(vec![]),
            ..Default::default()
        };
        let manager = build_manager_custom(
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;
        assert!(manager
            .get_subtitle_vtt("h", 0, 1)
            .await
            .unwrap_err()
            .to_string()
            .contains("File not found"));

        // 文件未下载
        let dir = temp_dir("vtt_not_downloaded");
        let repo = MockTorrentRepository {
            files: Some(vec![FileDetails {
                id: 0,
                name: "a.mkv".to_string(),
                len: 10,
            }]),
            ..Default::default()
        };
        let manager = build_manager_custom_with_dir(
            dir,
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;
        assert!(manager
            .get_subtitle_vtt("h", 0, 1)
            .await
            .unwrap_err()
            .to_string()
            .contains("not downloaded"));

        // 冷却期内命中失败缓存
        let dir = temp_dir("vtt_failure_cache");
        write_test_file(&dir, "a.mkv", b"data");
        let repo = MockTorrentRepository {
            files: Some(vec![FileDetails {
                id: 0,
                name: "a.mkv".to_string(),
                len: 10,
            }]),
            ..Default::default()
        };
        let cache = MockSubtitleCache {
            failure_result: Some("上次解析失败".to_string()),
            ..Default::default()
        };
        let manager = build_manager_custom_with_dir(
            dir,
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            Arc::new(cache),
            Arc::new(ok_extractor()),
        )
        .await;
        assert!(manager
            .get_subtitle_vtt("h", 0, 1)
            .await
            .unwrap_err()
            .to_string()
            .contains("上次解析失败"));

        // VTT 缓存命中
        let dir = temp_dir("vtt_cache_hit");
        write_test_file(&dir, "a.mkv", b"data");
        let repo = MockTorrentRepository {
            files: Some(vec![FileDetails {
                id: 0,
                name: "a.mkv".to_string(),
                len: 10,
            }]),
            ..Default::default()
        };
        let cache = MockSubtitleCache {
            vtt_result: Some("WEBVTT\ncached".to_string()),
            ..Default::default()
        };
        let manager = build_manager_custom_with_dir(
            dir,
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            Arc::new(cache),
            Arc::new(ok_extractor()),
        )
        .await;
        let vtt = manager
            .get_subtitle_vtt("h", 0, 1)
            .await
            .expect("缓存应命中");
        assert_eq!(vtt, "WEBVTT\ncached");

        // 提取成功并写入缓存
        let dir = temp_dir("vtt_success");
        write_test_file(&dir, "a.mkv", b"data");
        let repo = MockTorrentRepository {
            files: Some(vec![FileDetails {
                id: 0,
                name: "a.mkv".to_string(),
                len: 10,
            }]),
            ..Default::default()
        };
        let cache = Arc::new(MockSubtitleCache::default());
        let set_vtt_calls = cache.set_vtt_calls.clone();
        let manager = build_manager_custom_with_dir(
            dir,
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            cache.clone(),
            Arc::new(ok_extractor()),
        )
        .await;
        let vtt = manager
            .get_subtitle_vtt("h", 0, 1)
            .await
            .expect("提取应成功");
        assert_eq!(vtt, "WEBVTT\n");
        assert_eq!(*set_vtt_calls.lock().unwrap(), 1);

        // 提取失败并记录失败冷却
        let dir = temp_dir("vtt_failure");
        write_test_file(&dir, "a.mkv", b"data");
        let repo = MockTorrentRepository {
            files: Some(vec![FileDetails {
                id: 0,
                name: "a.mkv".to_string(),
                len: 10,
            }]),
            ..Default::default()
        };
        let cache = Arc::new(MockSubtitleCache::default());
        let set_failure_calls = cache.set_failure_calls.clone();
        let extractor_err = MockSubtitleExtractor {
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
            vtt_result: Err("解析字幕失败".to_string().into()),
        };
        let manager = build_manager_custom_with_dir(
            dir,
            Arc::new(repo),
            Arc::new(MockCrawlerRepository),
            cache.clone(),
            Arc::new(extractor_err),
        )
        .await;
        assert!(manager
            .get_subtitle_vtt("h", 0, 1)
            .await
            .unwrap_err()
            .to_string()
            .contains("解析字幕失败"));
        assert_eq!(*set_failure_calls.lock().unwrap(), 1);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_设置AI配置与下载速度限制_持久化() {
        let manager = build_manager_custom(
            Arc::new(MockTorrentRepository::default()),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;

        assert_eq!(manager.get_max_download_speed().await, None);
        manager
            .set_ai_configs(Some(vec![AiConfig {
                alias: "gpt".to_string(),
                api_endpoint: "https://example.com/v1".to_string(),
                api_key: "key".to_string(),
                ai_model: Some("gpt-4o".to_string()),
            }]))
            .await
            .expect("设置 AI 配置应成功");
        let settings = manager.get_settings().await.expect("读取设置应成功");
        assert_eq!(settings.ai_configs.as_ref().unwrap()[0].alias, "gpt");

        manager
            .set_max_download_speed(Some(256))
            .await
            .expect("设置下载限速应成功");
        assert_eq!(manager.get_max_download_speed().await, Some(256));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理基础地址与解析直播流() {
        let manager = build_manager_custom(
            Arc::new(MockTorrentRepository::default()),
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
        )
        .await;

        let base = manager.proxy_base_url().await;
        assert!(base.contains(&manager.port.to_string()));
        assert!(base.contains("/iptv-proxy"));

        let resolved = manager.resolve_stream("http://example.com/live").await;
        let resolved = resolved.expect("解析应成功");
        assert_eq!(resolved.kind, StreamKind::Hls);
        assert_eq!(resolved.proxy_url, base);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_种子控制操作_委托仓储与限速应用() {
        let repo = Arc::new(MockTorrentRepository {
            status: Some(TorrentStatusInfo {
                info_hash: "hash1".to_string(),
                name: "资源".to_string(),
                progress_bytes: 0,
                total_bytes: 100,
                finished: false,
                download_speed_bytes_per_sec: 0,
                upload_speed_bytes_per_sec: 0,
                paused: false,
                peers_connected: 0,
                peers_total: 0,
                created_at: 0,
                trackers: vec![],
                subject_id: None,
                subject_name: None,
            }),
            ..Default::default()
        });
        let download_dir_lock = Arc::new(RwLock::new(temp_dir("manager_speeds")));
        let db = AppDatabase::connect_in_memory()
            .await
            .expect("内存库应成功");
        let settings_repo: Arc<dyn SettingsRepository> =
            Arc::new(SqliteSettingsRepository::new(&db));
        let manager = TorrentManager::new(
            download_dir_lock,
            None,
            45680,
            repo,
            Arc::new(MockCrawlerRepository),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(ok_extractor()),
            Arc::new(MockStreamProber(StreamKind::Hls)),
            settings_repo,
        );
        // 应用初始速度限制（覆盖 apply_initial_speed_limits 路径）
        manager
            .apply_initial_speed_limits(Some(100), Some(200))
            .await;
        assert_eq!(manager.get_max_download_speed().await, Some(100));
        assert_eq!(manager.get_max_upload_speed().await, Some(200));

        assert_eq!(manager.list_torrents().await.len(), 1);
        assert!(manager.get_torrent_status("hash1").await.is_some());
        assert!(manager.pause_torrent("hash1").await.is_ok());
        assert!(manager.resume_torrent("hash1").await.is_ok());
        assert!(manager.delete_torrent("hash1", false).await.is_ok());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_种子管理器及流式接口_综合逻辑() {
        let dir = temp_dir("manager_stream");
        let (manager, torrent_repo) = build_manager(dir).await.expect("初始化应成功");

        assert!(manager.port > 0, "Axum 应监听有效动态端口");

        // 生成 stream url
        let test_hash = "3a2a3e0f438a2e1d74381395bb0e6840742fef8e";
        let url = manager.get_stream_url(test_hash, 0).await;
        assert!(url.contains(&manager.port.to_string()));
        assert!(url.contains(test_hash));

        // 未找到种子时的 get_torrent_status 覆盖
        assert!(manager.get_torrent_status(test_hash).await.is_none());

        // 测试 HTTP 流式播放接口_未找到种子
        let hls_proxy = HlsProxyState::new(proxy_base_url(manager.port));
        let app = build_stream_router(StreamState {
            torrent_repo,
            hls_proxy,
        });

        use tower::ServiceExt;
        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .uri(format!("/stream/{}/0", test_hash))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), axum::http::StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_自定义下载目录_逻辑() {
        let dir = temp_dir("manager_download_dir");
        let (manager, _) = build_manager(dir.clone()).await.expect("初始化应成功");

        assert_eq!(
            manager.get_download_dir().await,
            dir.to_string_lossy().to_string()
        );

        let new_dir = dir.join("custom_downloads");
        let new_dir_str = new_dir.to_string_lossy().to_string();
        manager.set_download_dir(new_dir_str.clone()).await.unwrap();

        assert_eq!(manager.get_download_dir().await, new_dir_str);

        // 通过仓储回读验证持久化（DB 取代 JSON）
        let settings = manager.get_settings().await.unwrap();
        assert_eq!(settings.download_dir, new_dir_str);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_种子管理控制_未找到种子时的错误处理() {
        let dir = temp_dir("manager_control");
        let (manager, _) = build_manager(dir).await.expect("初始化应成功");

        assert!(manager.list_torrents().await.is_empty());

        let test_hash = "3a2a3e0f438a2e1d74381395bb0e6840742fef8e";

        assert!(manager.get_torrent_files(test_hash).await.is_none());
        assert!(manager.pause_torrent(test_hash).await.is_err());
        assert!(manager.resume_torrent(test_hash).await.is_err());
        assert!(manager.delete_torrent(test_hash, false).await.is_err());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_自定义代理_逻辑() {
        let dir = temp_dir("manager_proxy");
        std::fs::create_dir_all(&dir).unwrap();
        let (manager, _) = build_manager(dir).await.expect("初始化应成功");

        assert_eq!(manager.get_proxy().await, None);

        let proxy_str = "http://127.0.0.1:7890".to_string();
        manager.set_proxy(Some(proxy_str.clone())).await.unwrap();

        assert_eq!(manager.get_proxy().await, Some(proxy_str.clone()));

        // 通过仓储回读验证持久化（DB 取代 JSON）
        let settings = manager.get_settings().await.unwrap();
        assert_eq!(settings.proxy, Some(proxy_str));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_上传速度限制_逻辑() {
        let dir = temp_dir("manager_upload");
        std::fs::create_dir_all(&dir).unwrap();
        let (manager, _) = build_manager(dir.clone()).await.expect("初始化应成功");

        assert_eq!(manager.get_max_upload_speed().await, None);

        manager.set_max_upload_speed(Some(128)).await.unwrap();
        assert_eq!(manager.get_max_upload_speed().await, Some(128));

        // 通过仓储回读验证持久化（DB 取代 JSON）
        let settings = manager.get_settings().await.unwrap();
        assert_eq!(settings.max_upload_speed, Some(128));

        manager.set_max_upload_speed(Some(0)).await.unwrap();
        assert_eq!(manager.get_max_upload_speed().await, Some(0));

        manager.set_max_upload_speed(None).await.unwrap();
        assert_eq!(manager.get_max_upload_speed().await, None);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_字段级设置更新_空库初始化与清空() {
        // 取代旧的"异常JSON回退"测试：迁移到 DB 后不再有 JSON 解析路径，
        // 此测试覆盖空库场景下字段级 set/clear 行为。
        let dir = temp_dir("manager_persist_fresh");
        std::fs::create_dir_all(&dir).unwrap();
        let (manager, _) = build_manager(dir.clone()).await.expect("初始化应成功");

        let next_dir = dir.join("custom_downloads");
        manager
            .set_download_dir(next_dir.to_string_lossy().to_string())
            .await
            .unwrap();
        assert_eq!(
            manager.get_download_dir().await,
            next_dir.to_string_lossy().to_string()
        );

        let proxy = "socks5://127.0.0.1:1080".to_string();
        manager.set_proxy(Some(proxy.clone())).await.unwrap();
        assert_eq!(manager.get_proxy().await, Some(proxy));

        manager.set_max_download_speed(Some(0)).await.unwrap();
        manager.set_max_download_speed(None).await.unwrap();
        assert_eq!(manager.get_max_download_speed().await, None);

        manager.set_max_upload_speed(Some(0)).await.unwrap();
        manager.set_max_upload_speed(None).await.unwrap();
        assert_eq!(manager.get_max_upload_speed().await, None);

        manager.set_ai_configs(None).await.unwrap();
        let settings = manager.get_settings().await.unwrap();
        assert!(settings.ai_configs.is_none());
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_将KB每秒限制转换为bytes每秒() {
        assert_eq!(speed_kbps_to_bytes_per_sec(None), None);
        assert_eq!(speed_kbps_to_bytes_per_sec(Some(0)), None);
        assert_eq!(speed_kbps_to_bytes_per_sec(Some(128)), Some(128 * 1024));
        assert_eq!(speed_kbps_to_bytes_per_sec(Some(u32::MAX)), Some(u32::MAX));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_获取局域网IP_逻辑() {
        let ip = get_local_ip();
        if let Some(ref addr) = ip {
            assert_ne!(addr, "0.0.0.0");
            assert_ne!(addr, "127.0.0.1");
            assert_eq!(addr.split('.').count(), 4);
        }
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_选择最佳局域网IP_优先级() {
        use std::net::IpAddr;

        let user_interfaces = vec![
            ("xray0".to_string(), "198.18.0.1".parse::<IpAddr>().unwrap()),
            (
                "vEthernet (WSL (Hyper-V firewall))".to_string(),
                "172.31.208.1".parse::<IpAddr>().unwrap(),
            ),
            (
                "WLAN".to_string(),
                "192.168.0.106".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(
            select_best_local_ip(user_interfaces),
            Some("192.168.0.106".to_string())
        );

        let loopback_only = vec![
            ("lo".to_string(), "127.0.0.1".parse::<IpAddr>().unwrap()),
            (
                "unspecified".to_string(),
                "0.0.0.0".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(select_best_local_ip(loopback_only), None);

        let multiple_physical = vec![
            (
                "以太网".to_string(),
                "192.168.1.100".parse::<IpAddr>().unwrap(),
            ),
            (
                "WLAN".to_string(),
                "192.168.1.101".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(
            select_best_local_ip(multiple_physical),
            Some("192.168.1.101".to_string())
        );

        let simple_ip = vec![(
            "my_nic".to_string(),
            "192.168.1.50".parse::<IpAddr>().unwrap(),
        )];
        assert_eq!(
            select_best_local_ip(simple_ip),
            Some("192.168.1.50".to_string())
        );

        let link_local_only = vec![(
            "以太网".to_string(),
            "169.254.112.178".parse::<IpAddr>().unwrap(),
        )];
        assert_eq!(select_best_local_ip(link_local_only), None);

        let apipa_with_vpn = vec![
            ("xray0".to_string(), "198.18.0.1".parse::<IpAddr>().unwrap()),
            (
                "以太网".to_string(),
                "169.254.112.178".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(select_best_local_ip(apipa_with_vpn), None);

        let link_local_with_real = vec![
            (
                "以太网".to_string(),
                "169.254.112.178".parse::<IpAddr>().unwrap(),
            ),
            (
                "以太网".to_string(),
                "192.168.0.108".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(
            select_best_local_ip(link_local_with_real),
            Some("192.168.0.108".to_string())
        );
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_解析直播流_返回代理地址与类型() {
        let dir = temp_dir("manager_resolve_stream");
        let (manager, _) = build_manager(dir).await.expect("初始化应成功");

        let resolved = manager.resolve_stream("http://example.com/live.m3u8").await;
        let resolved = resolved.expect("解析应成功");
        assert!(resolved.proxy_url.contains(&manager.port.to_string()));
        assert!(resolved.proxy_url.contains("/iptv-proxy"));
    }
}
