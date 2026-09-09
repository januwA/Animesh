// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use animesh_core::application::collection_service::CollectionService;
use animesh_core::application::search_use_case::SearchUseCase;
use animesh_core::application::settings_service::{
    AiConfig, AppSettings, SettingsService, TranslationConfig,
};
use animesh_core::application::stream_service::StreamService;
use animesh_core::application::subtitle_service::SubtitleService;
use animesh_core::application::torrent_manager::TorrentManager;
use animesh_core::domain::collection::CollectionRecord;
use animesh_core::domain::settings::SettingsRepository;
use animesh_core::domain::subtitle_translations::{
    SubtitleTranslationRecord, SubtitleTranslationRepository,
};
use animesh_core::domain::subtitles::VideoMetadata;
use animesh_core::domain::torrent::{
    AddTorrentResult, FileDetails, SubjectBindingRepository, TorrentStatusInfo,
};
use animesh_core::error::CoreError;
use animesh_core::infrastructure::settings_repository::SqliteSettingsRepository;
use animesh_core::infrastructure::subject_binding_repository::SqliteSubjectBindingRepository;
use animesh_core::infrastructure::subtitle_translation_repository::SqliteSubtitleTranslationRepository;
use anyhow::Context;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use tauri::Manager;

pub fn trace_log(msg: &str) {
    log::info!("[TRACE] {}", msg);
}

pub struct AddMagnetTracker {
    pub handles: Mutex<HashMap<String, tokio::task::AbortHandle>>,
}

impl Default for AddMagnetTracker {
    fn default() -> Self {
        Self {
            handles: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
async fn torrent_add_magnet(
    trace_id: String,
    magnet: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
    tracker: tauri::State<'_, AddMagnetTracker>,
) -> Result<AddTorrentResult, CoreError> {
    trace_log(&format!(
        "Entering torrent_add_magnet command, trace_id: {}, magnet length: {}",
        trace_id,
        magnet.len()
    ));
    let clean_magnet = if magnet.len() > 60 {
        format!("{}...{}", &magnet[0..40], &magnet[magnet.len() - 20..])
    } else {
        magnet.to_string()
    };
    trace_log(&format!("Processed magnet string: {}", clean_magnet));

    let manager_clone = manager.inner().clone();
    let magnet_string = magnet.to_string();

    let task = tokio::spawn(async move { manager_clone.add_magnet(&magnet_string, None).await });

    let abort_handle = task.abort_handle();
    if let Ok(mut handles) = tracker.handles.lock() {
        handles.insert(trace_id.clone(), abort_handle);
    }

    let res = task.await;

    if let Ok(mut handles) = tracker.handles.lock() {
        handles.remove(&trace_id);
    }

    match res {
        Ok(inner) => {
            match &inner {
                Ok(t) => trace_log(&format!(
                    "torrent_add_magnet succeeded, info_hash: {}, files count: {}",
                    t.info_hash,
                    t.files.len()
                )),
                Err(e) => trace_log(&format!("torrent_add_magnet failed with error: {}", e)),
            }
            inner
        }
        Err(join_err) => {
            if join_err.is_cancelled() {
                trace_log(&format!(
                    "torrent_add_magnet was cancelled, trace_id: {}",
                    trace_id
                ));
                Err(CoreError::Message("添加磁力链接已取消".to_string()))
            } else {
                trace_log(&format!("torrent_add_magnet task panicked: {:?}", join_err));
                Err(CoreError::Message("添加磁力链接任务异常".to_string()))
            }
        }
    }
}

#[tauri::command]
async fn cancel_add_magnet(
    trace_id: String,
    tracker: tauri::State<'_, AddMagnetTracker>,
) -> Result<(), CoreError> {
    trace_log(&format!(
        "Entering cancel_add_magnet command, trace_id: {}",
        trace_id
    ));
    if let Ok(mut handles) = tracker.handles.lock() {
        if let Some(handle) = handles.remove(&trace_id) {
            handle.abort();
            trace_log(&format!(
                "Successfully aborted add_magnet for trace_id: {}",
                trace_id
            ));
        } else {
            trace_log(&format!(
                "No active add_magnet found to abort for trace_id: {}",
                trace_id
            ));
        }
    }
    Ok(())
}

#[tauri::command]
async fn get_stream_port(
    stream_service: tauri::State<'_, Arc<StreamService>>,
) -> Result<u16, CoreError> {
    Ok(stream_service.port())
}

#[tauri::command]
async fn get_local_ip() -> Result<String, CoreError> {
    Ok(animesh_core::infrastructure::local_ip::get_local_ip()
        .unwrap_or_else(|| "127.0.0.1".to_string()))
}

#[tauri::command]
async fn iptv_resolve_stream(
    raw_url: String,
    stream_service: tauri::State<'_, Arc<StreamService>>,
) -> Result<animesh_core::domain::stream::ResolvedStream, CoreError> {
    trace_log(&format!("iptv_resolve_stream raw_url={raw_url}"));
    let resolved = stream_service.resolve_stream(&raw_url).await?;
    trace_log(&format!(
        "iptv_resolve_stream resolved kind={:?}",
        resolved.kind
    ));
    Ok(resolved)
}

#[tauri::command]
async fn torrent_get_files(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<Vec<FileDetails>, CoreError> {
    manager
        .get_torrent_files(info_hash)
        .await
        .ok_or(CoreError::TorrentNotFound)
}

#[tauri::command]
async fn torrent_get_trackers(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<Vec<String>, CoreError> {
    manager
        .get_trackers(info_hash)
        .await
        .ok_or(CoreError::TorrentNotFound)
}

#[tauri::command]
async fn torrent_update_only_files(
    info_hash: &str,
    only_files: Vec<usize>,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    trace_log(&format!(
        "torrent_update_only_files info_hash: {}, only_files: {:?}",
        info_hash, only_files
    ));
    manager
        .update_only_files(info_hash, only_files.into_iter().collect())
        .await
}

#[tauri::command]
async fn torrent_get_video_metadata(
    info_hash: &str,
    file_id: usize,
    subtitle_service: tauri::State<'_, Arc<SubtitleService>>,
) -> Result<VideoMetadata, CoreError> {
    trace_log(&format!(
        "Entering torrent_get_video_metadata command, info_hash: {}, file_id: {}",
        info_hash, file_id
    ));
    subtitle_service
        .get_video_metadata(info_hash, file_id)
        .await
}

#[tauri::command]
async fn torrent_get_subtitle_vtt(
    info_hash: &str,
    file_id: usize,
    track_id: u64,
    subtitle_service: tauri::State<'_, Arc<SubtitleService>>,
) -> Result<String, CoreError> {
    trace_log(&format!(
        "Entering torrent_get_subtitle_vtt command, info_hash: {}, file_id: {}, track_id: {}",
        info_hash, file_id, track_id
    ));
    subtitle_service
        .get_subtitle_vtt(info_hash, file_id, track_id)
        .await
}

#[tauri::command]
async fn torrent_pause(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    manager.pause_torrent(info_hash).await
}

#[tauri::command]
async fn torrent_resume(
    info_hash: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    manager.resume_torrent(info_hash).await
}

#[tauri::command]
async fn torrent_delete(
    info_hash: &str,
    delete_files: bool,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    manager.delete_torrent(info_hash, delete_files).await
}

#[tauri::command]
async fn torrent_set_subject(
    info_hash: &str,
    subject_id: u64,
    platform: String,
    subject_name: &str,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    trace_log(&format!(
        "torrent_set_subject info_hash: {}, subject_id: {}, platform: {}, subject_name: {}",
        info_hash, subject_id, platform, subject_name
    ));
    manager
        .set_subject_binding(info_hash, subject_id, platform, subject_name.to_string())
        .await;
    Ok(())
}

#[tauri::command]
async fn torrent_clear_subject(
    info_hash: &str,
    platform: String,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    trace_log(&format!(
        "torrent_clear_subject info_hash: {}, platform: {}",
        info_hash, platform
    ));
    manager.clear_subject_binding(info_hash, &platform).await;
    Ok(())
}

#[tauri::command]
async fn collection_get_all(
    service: tauri::State<'_, Arc<CollectionService>>,
) -> Result<Vec<CollectionRecord>, CoreError> {
    service.list().await
}

#[tauri::command]
async fn collection_is_favorited(
    subject_id: i64,
    platform: String,
    service: tauri::State<'_, Arc<CollectionService>>,
) -> Result<bool, CoreError> {
    service.is_favorited(subject_id, &platform).await
}

#[tauri::command]
async fn collection_add(
    subject_id: i64,
    name: String,
    image_url: Option<String>,
    platform: String,
    service: tauri::State<'_, Arc<CollectionService>>,
) -> Result<(), CoreError> {
    service
        .add(animesh_core::domain::collection::NewCollectionItem {
            subject_id,
            platform,
            name,
            image_url,
        })
        .await
}

#[tauri::command]
async fn collection_remove(
    subject_id: i64,
    platform: String,
    service: tauri::State<'_, Arc<CollectionService>>,
) -> Result<(), CoreError> {
    service.remove(subject_id, &platform).await
}

#[tauri::command]
async fn torrent_subscribe(
    on_event: tauri::ipc::Channel<Vec<TorrentStatusInfo>>,
    manager: tauri::State<'_, Arc<TorrentManager>>,
) -> Result<(), CoreError> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let torrents = manager.list_torrents().await;
            if on_event.send(torrents).is_err() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(3000)).await;
        }
    });
    Ok(())
}

#[tauri::command]
async fn settings_get(
    settings_service: tauri::State<'_, Arc<SettingsService>>,
) -> Result<AppSettings, CoreError> {
    settings_service.get_settings().await
}

#[tauri::command]
async fn settings_set_download_dir(
    dir: &str,
    settings_service: tauri::State<'_, Arc<SettingsService>>,
) -> Result<(), CoreError> {
    settings_service.set_download_dir(dir.to_string()).await
}

#[tauri::command]
async fn settings_set_proxy(
    proxy: Option<String>,
    settings_service: tauri::State<'_, Arc<SettingsService>>,
) -> Result<(), CoreError> {
    settings_service.set_proxy(proxy).await
}

#[tauri::command]
async fn settings_set_ai_configs(
    configs: Option<Vec<AiConfig>>,
    settings_service: tauri::State<'_, Arc<SettingsService>>,
) -> Result<(), CoreError> {
    settings_service.set_ai_configs(configs).await
}

#[tauri::command]
async fn settings_set_max_download_speed(
    max_speed: Option<u32>,
    settings_service: tauri::State<'_, Arc<SettingsService>>,
) -> Result<(), CoreError> {
    settings_service.set_max_download_speed(max_speed).await
}

#[tauri::command]
async fn settings_set_max_upload_speed(
    max_speed: Option<u32>,
    settings_service: tauri::State<'_, Arc<SettingsService>>,
) -> Result<(), CoreError> {
    settings_service.set_max_upload_speed(max_speed).await
}

#[tauri::command]
async fn settings_set_translation_config(
    config: Option<TranslationConfig>,
    settings_service: tauri::State<'_, Arc<SettingsService>>,
) -> Result<(), CoreError> {
    settings_service.set_translation_config(config).await
}

#[tauri::command]
async fn select_directory(app: tauri::AppHandle) -> Result<Option<String>, CoreError> {
    #[cfg(mobile)]
    {
        let _ = app;
        return Err(CoreError::Message(
            "Directory selection is not supported on mobile devices.".to_string(),
        ));
    }

    #[cfg(desktop)]
    {
        let path = tauri::async_runtime::spawn_blocking(move || {
            use tauri_plugin_dialog::DialogExt;
            app.dialog()
                .file()
                .blocking_pick_folder()
                .map(|file_path| match file_path {
                    tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
                    tauri_plugin_dialog::FilePath::Url(u) => {
                        if let Ok(p) = u.to_file_path() {
                            p.to_string_lossy().to_string()
                        } else {
                            u.to_string()
                        }
                    }
                })
        })
        .await
        .map_err(|e| CoreError::Message(e.to_string()))?;
        Ok(path)
    }
}

#[tauri::command]
async fn subtitle_translation_get(
    id: String,
    repo: tauri::State<'_, Arc<SqliteSubtitleTranslationRepository>>,
) -> Result<Option<SubtitleTranslationRecord>, CoreError> {
    repo.get_by_id(&id).await
}

#[tauri::command]
async fn subtitle_translation_list_by_torrent(
    info_hash: String,
    file_id: i64,
    repo: tauri::State<'_, Arc<SqliteSubtitleTranslationRepository>>,
) -> Result<Vec<SubtitleTranslationRecord>, CoreError> {
    repo.list_by_torrent(&info_hash, file_id).await
}

#[tauri::command]
async fn subtitle_translation_save(
    record: SubtitleTranslationRecord,
    repo: tauri::State<'_, Arc<SqliteSubtitleTranslationRepository>>,
) -> Result<(), CoreError> {
    repo.save(&record).await
}

#[tauri::command]
async fn subtitle_translation_delete(
    id: String,
    repo: tauri::State<'_, Arc<SqliteSubtitleTranslationRepository>>,
) -> Result<bool, CoreError> {
    repo.delete_by_id(&id).await
}

#[tauri::command]
async fn subtitle_translation_delete_by_torrent(
    info_hash: String,
    file_id: i64,
    repo: tauri::State<'_, Arc<SqliteSubtitleTranslationRepository>>,
) -> Result<u64, CoreError> {
    repo.delete_by_torrent(&info_hash, file_id).await
}

#[tauri::command]
async fn subtitle_translation_delete_by_info_hash(
    info_hash: String,
    repo: tauri::State<'_, Arc<SqliteSubtitleTranslationRepository>>,
) -> Result<u64, CoreError> {
    repo.delete_by_info_hash(&info_hash).await
}

/// 启动时加载或初始化设置。DB 已有记录则读取，否则写入默认值。
///
/// 返回启动期 TorrentManager 需要的下载目录、代理、限速等字段。
async fn load_or_init_settings(
    settings_repo: &Arc<dyn SettingsRepository>,
    app_data_dir: &Path,
) -> Result<(PathBuf, Option<String>, Option<u32>, Option<u32>), CoreError> {
    // DB 已有记录
    if let Some(existing) = settings_repo.get().await? {
        log::info!("从数据库加载已有设置");
        return Ok((
            PathBuf::from(existing.download_dir),
            existing.proxy,
            existing.max_download_speed,
            existing.max_upload_speed,
        ));
    }

    // 初始化默认值
    let default_dir = app_data_dir.join("downloads");
    let default_settings = AppSettings {
        download_dir: default_dir.to_string_lossy().to_string(),
        proxy: None,
        ai_configs: None,
        max_download_speed: None,
        max_upload_speed: None,
        translation: None,
    };
    settings_repo.ensure_initialized(&default_settings).await?;
    log::info!("使用默认设置初始化数据库");
    Ok((default_dir, None, None, None))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::panic::set_hook(Box::new(|info| {
        let msg = match info.payload().downcast_ref::<&str>() {
            Some(s) => *s,
            None => match info.payload().downcast_ref::<String>() {
                Some(s) => &**s,
                None => "Box<dyn Any>",
            },
        };
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown location".to_string());
        let backtrace = std::backtrace::Backtrace::capture();
        log::error!(
            "Panic occurred at {}:\n{}\nBacktrace:\n{:?}",
            location,
            msg,
            backtrace
        );
    }));

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .filter(|metadata| {
                    let target = metadata.target();
                    !target.starts_with("librqbit") && !target.starts_with("tracing")
                })
                .build(),
        )
        .plugin(tauri_plugin_notification::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            tauri::async_runtime::block_on(async {
                let app_data_dir = app
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::env::temp_dir().join("animesh"));
                tokio::fs::create_dir_all(&app_data_dir).await.ok();

                let db = Arc::new(
                    animesh_core::infrastructure::db::AppDatabase::connect(
                        &app_data_dir.join("animesh.sqlite"),
                    )
                    .await
                    .context("初始化 AppDatabase 失败")?,
                );

                // 设置仓储：从 DB 加载或初始化默认值
                let settings_repo: Arc<dyn SettingsRepository> =
                    Arc::new(SqliteSettingsRepository::new(&db));
                let (download_dir, _proxy, max_download_speed, max_upload_speed) =
                    load_or_init_settings(&settings_repo, &app_data_dir).await?;

                tokio::fs::create_dir_all(&download_dir).await.ok();

                let download_dir_lock = Arc::new(RwLock::new(download_dir));
                let persistence_dir = app_data_dir.join("torrents");
                let torrent_repo = animesh_core::infrastructure::rqbit_torrent::create_torrent_repository(
                    download_dir_lock.clone(),
                    persistence_dir,
                )
                .await
                .context("初始化 TorrentRepository 失败")?;
                let subject_binding_repo: Arc<dyn SubjectBindingRepository> = Arc::new(
                    SqliteSubjectBindingRepository::new(&db).await,
                );

                let crawler_repo =
                    animesh_core::infrastructure::http_crawler::create_crawler_repository();
                let search_use_case = Arc::new(SearchUseCase::new(crawler_repo, settings_repo.clone()));

                let http_client = Arc::new(animesh_core::infrastructure::http_client::ReqwestHttpClient);
                let ai_chat_use_case = Arc::new(
                    animesh_core::application::ai_chat_use_case::AiChatUseCase::new(
                        http_client,
                        settings_repo.clone(),
                    ),
                );

                let (port, hls_proxy) =
                    animesh_core::infrastructure::stream_server::start_stream_server(
                        torrent_repo.clone(),
                        search_use_case,
                        ai_chat_use_case,
                    )
                    .await
                    .context("初始化流媒体服务器失败")?;

                let subtitle_cache: Arc<dyn animesh_core::domain::subtitles::SubtitleCache> =
                    Arc::new(
                        animesh_core::infrastructure::subtitle_cache::InMemorySubtitleCache::new(),
                    );
                let subtitle_extractor: Arc<
                    dyn animesh_core::domain::subtitles::SubtitleExtractor,
                > = Arc::new(animesh_core::infrastructure::matroska_subtitles::MatroskaSubtitleExtractor);
                let stream_prober: Arc<
                    dyn animesh_core::domain::stream::StreamProber,
                > = Arc::new(hls_proxy);

                let torrent_manager = TorrentManager::new(torrent_repo.clone(), subject_binding_repo);
                let settings_service = SettingsService::new(
                    settings_repo.clone(),
                    torrent_repo.clone(),
                    download_dir_lock.clone(),
                );
                let subtitle_service = SubtitleService::new(
                    torrent_repo.clone(),
                    subtitle_cache,
                    subtitle_extractor,
                    download_dir_lock.clone(),
                );
                let stream_service = StreamService::new(stream_prober, port);

                // 应用启动时持久化的初始速度限制（DB 已存值）
                settings_service
                    .apply_initial_speed_limits(max_download_speed, max_upload_speed)
                    .await;

                let collection_service = CollectionService::new(Arc::new(
                    animesh_core::infrastructure::collection_repository::SqliteCollectionRepository::new(
                        &db,
                    ),
                ));
                let subtitle_translation_repo = Arc::new(
                    SqliteSubtitleTranslationRepository::new(&db),
                );

                app.manage(Arc::new(torrent_manager));
                app.manage(Arc::new(settings_service));
                app.manage(Arc::new(subtitle_service));
                app.manage(Arc::new(stream_service));
                app.manage(Arc::new(collection_service));
                app.manage(subtitle_translation_repo);
                app.manage(AddMagnetTracker::default());
                Ok(())
            })
        })
        .invoke_handler(tauri::generate_handler![
            torrent_add_magnet,
            cancel_add_magnet,
            get_stream_port,
            get_local_ip,
            iptv_resolve_stream,
            torrent_get_files,
            torrent_get_trackers,
            torrent_update_only_files,
            torrent_pause,
            torrent_resume,
            torrent_delete,
            torrent_set_subject,
            torrent_clear_subject,
            collection_get_all,
            collection_is_favorited,
            collection_add,
            collection_remove,
            torrent_subscribe,
            settings_get,
            settings_set_download_dir,
            settings_set_proxy,
            settings_set_ai_configs,
            settings_set_max_download_speed,
            settings_set_max_upload_speed,
            settings_set_translation_config,
            select_directory,
            torrent_get_video_metadata,
            torrent_get_subtitle_vtt,
            subtitle_translation_get,
            subtitle_translation_list_by_torrent,
            subtitle_translation_save,
            subtitle_translation_delete,
            subtitle_translation_delete_by_torrent,
            subtitle_translation_delete_by_info_hash
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
