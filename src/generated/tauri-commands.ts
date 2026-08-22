// 自动生成的 Tauri Command 注册表
// 请勿手动编辑，运行 `cargo run -p xtask -- generate` 重新生成

export const commands = {
  cancelSearch: "cancel_search",
  searchTorrents: "search_torrents",
  torrentAddMagnet: "torrent_add_magnet",
  cancelAddMagnet: "cancel_add_magnet",
  torrentGetStreamUrl: "torrent_get_stream_url",
  iptvProxyBaseUrl: "iptv_proxy_base_url",
  iptvResolveStream: "iptv_resolve_stream",
  torrentGetFiles: "torrent_get_files",
  torrentGetVideoMetadata: "torrent_get_video_metadata",
  torrentGetSubtitleVtt: "torrent_get_subtitle_vtt",
  torrentPause: "torrent_pause",
  torrentResume: "torrent_resume",
  torrentDelete: "torrent_delete",
  torrentSetSubject: "torrent_set_subject",
  torrentClearSubject: "torrent_clear_subject",
  collectionGetAll: "collection_get_all",
  collectionIsFavorited: "collection_is_favorited",
  collectionAdd: "collection_add",
  collectionRemove: "collection_remove",
  torrentSubscribe: "torrent_subscribe",
  settingsGet: "settings_get",
  settingsSetDownloadDir: "settings_set_download_dir",
  settingsSetProxy: "settings_set_proxy",
  settingsSetAiConfigs: "settings_set_ai_configs",
  settingsSetMaxDownloadSpeed: "settings_set_max_download_speed",
  settingsSetMaxUploadSpeed: "settings_set_max_upload_speed",
  selectDirectory: "select_directory",
  aiChatRequest: "ai_chat_request",
  subtitleTranslationGet: "subtitle_translation_get",
  subtitleTranslationListByTorrent: "subtitle_translation_list_by_torrent",
  subtitleTranslationSave: "subtitle_translation_save",
  subtitleTranslationDelete: "subtitle_translation_delete",
  subtitleTranslationDeleteByTorrent: "subtitle_translation_delete_by_torrent",
  subtitleTranslationDeleteByInfoHash:
    "subtitle_translation_delete_by_info_hash",
} as const;

export type CommandName = (typeof commands)[keyof typeof commands];
