use crate::domain::subtitles::{SubtitleCache, SubtitleExtractor, VideoMetadata};
use crate::domain::torrent::TorrentRepository;
use crate::error::{CoreError, CoreResult};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;

/// 字幕用例:从 MKV 文件中提取视频元数据与字幕 VTT。
///
/// VTT 提取带缓存与失败冷却:命中缓存直接返回;失败冷却期内不再重复读取整个 MKV,
/// 避免下载未完成时反复打开大文件。`download_dir_lock` 与 `SettingsService` 共享,
/// 下载目录变更后立即对字幕提取生效。
pub struct SubtitleService {
    torrent_repo: Arc<dyn TorrentRepository>,
    subtitle_cache: Arc<dyn SubtitleCache>,
    subtitle_extractor: Arc<dyn SubtitleExtractor>,
    download_dir_lock: Arc<RwLock<PathBuf>>,
}

impl SubtitleService {
    pub fn new(
        torrent_repo: Arc<dyn TorrentRepository>,
        subtitle_cache: Arc<dyn SubtitleCache>,
        subtitle_extractor: Arc<dyn SubtitleExtractor>,
        download_dir_lock: Arc<RwLock<PathBuf>>,
    ) -> Self {
        Self {
            torrent_repo,
            subtitle_cache,
            subtitle_extractor,
            download_dir_lock,
        }
    }

    /// 解析种子内指定文件的本地路径。文件不存在时返回 `VideoNotDownloaded`。
    async fn resolve_local_file_path(
        &self,
        info_hash: &str,
        file_id: usize,
    ) -> CoreResult<PathBuf> {
        let download_dir = self.download_dir_lock.read().unwrap().clone();
        let files = self
            .torrent_repo
            .get_torrent_files(info_hash)
            .await
            .ok_or(CoreError::TorrentNotFound)?;
        let file_details = files
            .iter()
            .find(|f| f.id == file_id)
            .ok_or(CoreError::FileNotFound)?;

        let path = download_dir.join(&file_details.name);
        if !path.exists() {
            return Err(CoreError::VideoNotDownloaded);
        }
        Ok(path)
    }

    /// 提取视频元数据(字幕轨道、媒体信息、章节)。仅支持 MKV 格式。
    pub async fn get_video_metadata(
        &self,
        info_hash: &str,
        file_id: usize,
    ) -> CoreResult<VideoMetadata> {
        let path = self.resolve_local_file_path(info_hash, file_id).await?;

        let is_mkv = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("mkv"))
            .unwrap_or(false);
        if !is_mkv {
            return Err(CoreError::UnsupportedVideoFormat);
        }

        self.subtitle_extractor.extract_video_metadata(&path).await
    }

    /// 提取字幕 VTT。命中缓存直接返回;失败带冷却,避免下载未完成时反复读取整个 MKV。
    pub async fn get_subtitle_vtt(
        &self,
        info_hash: &str,
        file_id: usize,
        track_id: u64,
    ) -> CoreResult<String> {
        let path = self.resolve_local_file_path(info_hash, file_id).await?;

        let cache = self.subtitle_cache.clone();
        let failure_key = format!("{}:{}:{}", info_hash, file_id, track_id);
        if let Some(error) = cache.get_failure(&failure_key, &path, None).await {
            return Err(CoreError::Message(error));
        }
        if let Some(vtt) = cache.get_vtt(info_hash, file_id, track_id, &path).await {
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
                    .set_vtt(info_hash, file_id, track_id, &path, vtt.clone())
                    .await;
                Ok(vtt)
            }
            Ok(Err(e)) => {
                cache
                    .set_failure(&failure_key, &path, e.to_string(), None)
                    .await;
                Err(e)
            }
            Err(_) => {
                let message = CoreError::SubtitleParseTimeout;
                cache
                    .set_failure(&failure_key, &path, message.to_string(), None)
                    .await;
                Err(message)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::subtitles::{VideoInfo, VideoMetadata};
    use crate::domain::torrent::FileDetails;
    use crate::infrastructure::test_mocks::{
        temp_dir, write_test_file, MockSubtitleCache, MockSubtitleExtractor, MockTorrentRepository,
    };
    use std::path::Path;

    async fn build_service(
        download_dir: PathBuf,
        torrent_repo: Arc<dyn TorrentRepository>,
        subtitle_cache: Arc<dyn SubtitleCache>,
        subtitle_extractor: Arc<dyn SubtitleExtractor>,
    ) -> SubtitleService {
        std::fs::create_dir_all(&download_dir).unwrap();
        let download_dir_lock = Arc::new(RwLock::new(download_dir));
        SubtitleService::new(
            torrent_repo,
            subtitle_cache,
            subtitle_extractor,
            download_dir_lock,
        )
    }

    fn mkv_file() -> Vec<FileDetails> {
        vec![FileDetails {
            id: 0,
            name: "a.mkv".to_string(),
            len: 10,
            included: true,
        }]
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_获取视频元数据_各分支() {
        // 种子不存在
        let dir = temp_dir("metadata_no_torrent");
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default()),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(MockSubtitleExtractor::ok()),
        )
        .await;
        assert!(get_metadata_err(&service, "h", 0)
            .await
            .contains("Torrent not found"));

        // 文件不存在
        let dir = temp_dir("metadata_no_file");
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default().with_files(vec![])),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(MockSubtitleExtractor::ok()),
        )
        .await;
        assert!(get_metadata_err(&service, "h", 0)
            .await
            .contains("File not found"));

        // 文件未下载
        let dir = temp_dir("metadata_not_downloaded");
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default().with_files(mkv_file())),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(MockSubtitleExtractor::ok()),
        )
        .await;
        assert!(get_metadata_err(&service, "h", 0)
            .await
            .contains("not downloaded"));

        // 非 MKV 格式
        let dir = temp_dir("metadata_not_mkv");
        write_test_file(&dir, "a.mp4", b"data");
        let service = build_service(
            dir,
            Arc::new(
                MockTorrentRepository::default().with_files(vec![FileDetails {
                    id: 0,
                    name: "a.mp4".to_string(),
                    len: 10,
                    included: true,
                }]),
            ),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(MockSubtitleExtractor::ok()),
        )
        .await;
        assert!(get_metadata_err(&service, "h", 0)
            .await
            .contains("Unsupported video format"));

        // 成功提取(mock extractor 返回元数据)
        let dir = temp_dir("metadata_ok");
        write_test_file(&dir, "a.mkv", b"data");
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default().with_files(mkv_file())),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(MockSubtitleExtractor::ok()),
        )
        .await;
        let metadata = service
            .get_video_metadata("h", 0)
            .await
            .expect("提取应成功");
        assert!(metadata.tracks.is_empty());

        // 提取失败透传错误
        let dir = temp_dir("metadata_err");
        write_test_file(&dir, "a.mkv", b"data");
        let extractor_err = MockSubtitleExtractor {
            metadata_result: Err("提取失败".to_string().into()),
            vtt_result: Ok("WEBVTT\n".to_string()),
        };
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default().with_files(mkv_file())),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(extractor_err),
        )
        .await;
        assert!(get_metadata_err(&service, "h", 0)
            .await
            .contains("提取失败"));
    }

    async fn get_metadata_err(service: &SubtitleService, hash: &str, file_id: usize) -> String {
        service
            .get_video_metadata(hash, file_id)
            .await
            .unwrap_err()
            .to_string()
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_提取字幕VTT_缓存与错误处理() {
        // 种子不存在
        let dir = temp_dir("vtt_no_torrent");
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default()),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(MockSubtitleExtractor::ok()),
        )
        .await;
        assert!(get_vtt_err(&service, "h", 0, 1)
            .await
            .contains("Torrent not found"));

        // 文件不存在
        let dir = temp_dir("vtt_no_file");
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default().with_files(vec![])),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(MockSubtitleExtractor::ok()),
        )
        .await;
        assert!(get_vtt_err(&service, "h", 0, 1)
            .await
            .contains("File not found"));

        // 文件未下载
        let dir = temp_dir("vtt_not_downloaded");
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default().with_files(mkv_file())),
            Arc::new(MockSubtitleCache::default()),
            Arc::new(MockSubtitleExtractor::ok()),
        )
        .await;
        assert!(get_vtt_err(&service, "h", 0, 1)
            .await
            .contains("not downloaded"));

        // 冷却期内命中失败缓存
        let dir = temp_dir("vtt_failure_cache");
        write_test_file(&dir, "a.mkv", b"data");
        let cache = MockSubtitleCache {
            failure_result: Some("上次解析失败".to_string()),
            ..Default::default()
        };
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default().with_files(mkv_file())),
            Arc::new(cache),
            Arc::new(MockSubtitleExtractor::ok()),
        )
        .await;
        assert!(get_vtt_err(&service, "h", 0, 1)
            .await
            .contains("上次解析失败"));

        // VTT 缓存命中
        let dir = temp_dir("vtt_cache_hit");
        write_test_file(&dir, "a.mkv", b"data");
        let cache = MockSubtitleCache {
            vtt_result: Some("WEBVTT\ncached".to_string()),
            ..Default::default()
        };
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default().with_files(mkv_file())),
            Arc::new(cache),
            Arc::new(MockSubtitleExtractor::ok()),
        )
        .await;
        let vtt = service
            .get_subtitle_vtt("h", 0, 1)
            .await
            .expect("缓存应命中");
        assert_eq!(vtt, "WEBVTT\ncached");

        // 提取成功并写入缓存
        let dir = temp_dir("vtt_success");
        write_test_file(&dir, "a.mkv", b"data");
        let cache = Arc::new(MockSubtitleCache::default());
        let set_vtt_calls = cache.set_vtt_calls.clone();
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default().with_files(mkv_file())),
            cache.clone(),
            Arc::new(MockSubtitleExtractor::ok()),
        )
        .await;
        let vtt = service
            .get_subtitle_vtt("h", 0, 1)
            .await
            .expect("提取应成功");
        assert_eq!(vtt, "WEBVTT\n");
        assert_eq!(*set_vtt_calls.lock().unwrap(), 1);

        // 提取失败并记录失败冷却
        let dir = temp_dir("vtt_failure");
        write_test_file(&dir, "a.mkv", b"data");
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
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default().with_files(mkv_file())),
            cache.clone(),
            Arc::new(extractor_err),
        )
        .await;
        assert!(get_vtt_err(&service, "h", 0, 1)
            .await
            .contains("解析字幕失败"));
        assert_eq!(*set_failure_calls.lock().unwrap(), 1);
    }

    #[tokio::test(start_paused = true)]
    #[allow(non_snake_case)]
    async fn 测试_提取字幕VTT_超时返回错误并记录冷却() {
        struct NeverResolveExtractor;

        #[async_trait::async_trait]
        impl SubtitleExtractor for NeverResolveExtractor {
            async fn extract_video_metadata(&self, _path: &Path) -> CoreResult<VideoMetadata> {
                Err("未配置".to_string().into())
            }
            async fn extract_subtitle_vtt(
                &self,
                _path: &Path,
                _track_id: u64,
            ) -> CoreResult<String> {
                std::future::pending::<()>().await;
                unreachable!()
            }
        }

        let dir = temp_dir("vtt_timeout");
        write_test_file(&dir, "a.mkv", b"data");
        let cache = Arc::new(MockSubtitleCache::default());
        let set_failure_calls = cache.set_failure_calls.clone();
        let service = build_service(
            dir,
            Arc::new(MockTorrentRepository::default().with_files(mkv_file())),
            cache.clone(),
            Arc::new(NeverResolveExtractor),
        )
        .await;

        // 在独立任务中运行 get_subtitle_vtt,主任务推进模拟时钟越过 15 秒超时
        let handle = tokio::spawn(async move { service.get_subtitle_vtt("h", 0, 1).await });

        // 让 spawned task 有机会启动并注册 15 秒超时定时器
        tokio::task::yield_now().await;

        tokio::time::advance(Duration::from_secs(16)).await;

        let result = handle.await.unwrap();
        let err = result.unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("timed out"), "超时应触发错误,实际: {msg}");
        assert_eq!(*set_failure_calls.lock().unwrap(), 1);
    }

    async fn get_vtt_err(
        service: &SubtitleService,
        hash: &str,
        file_id: usize,
        track_id: u64,
    ) -> String {
        service
            .get_subtitle_vtt(hash, file_id, track_id)
            .await
            .unwrap_err()
            .to_string()
    }
}
