import { createContext, use } from "react";
import {
  IptvRepositoryImpl,
  IptvStreamUrlRepositoryImpl,
  NotificationRepositoryImpl,
  OpenerRepositoryImpl,
  UpdateRepositoryImpl,
} from "@/di/repositories";
import { FetchAiClient } from "@/infrastructure/ai/FetchAiClient";
import { TauriAiClient } from "@/infrastructure/ai/TauriAiClient";
import { TauriSubtitleTranslationRepository } from "@/infrastructure/subtitle/TauriSubtitleTranslationRepository";
import { GetBangumiCalendarUseCase } from "../application/bangumi/GetBangumiCalendarUseCase";
import { GetBangumiCharactersUseCase } from "../application/bangumi/GetBangumiCharactersUseCase";
import { GetBangumiEpisodesUseCase } from "../application/bangumi/GetBangumiEpisodesUseCase";
import { GetBangumiPersonsUseCase } from "../application/bangumi/GetBangumiPersonsUseCase";
import { GetBangumiSubjectUseCase } from "../application/bangumi/GetBangumiSubjectUseCase";
import { ClearCacheUseCase } from "../application/cache/ClearCacheUseCase";
import { AddFavoriteUseCase } from "../application/collection/AddFavoriteUseCase";
import { GetCollectionsUseCase } from "../application/collection/GetCollectionsUseCase";
import { GetFavoriteStatusUseCase } from "../application/collection/GetFavoriteStatusUseCase";
import { RemoveFavoriteUseCase } from "../application/collection/RemoveFavoriteUseCase";
import { GetIptvChannelsUseCase } from "../application/iptv/GetIptvChannelsUseCase";
import { GetIptvCountriesUseCase } from "../application/iptv/GetIptvCountriesUseCase";
import { ResolvePlayableStreamUrlUseCase } from "../application/iptv/ResolvePlayableStreamUrlUseCase";
import { NotifyDownloadCompletionUseCase } from "../application/notification/NotifyDownloadCompletionUseCase";
import { RequestNotificationPermissionUseCase } from "../application/notification/RequestNotificationPermissionUseCase";
import { OpenUrlUseCase } from "../application/opener/OpenUrlUseCase";
import { GetSettingsUseCase } from "../application/settings/GetSettingsUseCase";
import { SaveSettingsUseCase } from "../application/settings/SaveSettingsUseCase";
import { SelectDirectoryUseCase } from "../application/settings/SelectDirectoryUseCase";
import { SetThemeUseCase } from "../application/settings/SetThemeUseCase";
import { VerifyAiConnectionUseCase } from "../application/settings/VerifyAiConnectionUseCase";
import { GetSubtitleTranslationsUseCase } from "../application/subtitle/GetSubtitleTranslationsUseCase";
import { TranslateSubtitleUseCase } from "../application/subtitle/TranslateSubtitleUseCase";
import { ClearTorrentSubjectUseCase } from "../application/torrent/ClearTorrentSubjectUseCase";
import { DeleteTorrentUseCase } from "../application/torrent/DeleteTorrentUseCase";
import { GetSubtitleVttUseCase } from "../application/torrent/GetSubtitleVttUseCase";
import { GetTorrentStreamUrlUseCase } from "../application/torrent/GetTorrentStreamUrlUseCase";
import { GetVideoMetadataUseCase } from "../application/torrent/GetVideoMetadataUseCase";
import { PauseTorrentUseCase } from "../application/torrent/PauseTorrentUseCase";
import { ResolveTorrentUseCase } from "../application/torrent/ResolveTorrentUseCase";
import { ResumeTorrentUseCase } from "../application/torrent/ResumeTorrentUseCase";
import { SearchTorrentsUseCase } from "../application/torrent/SearchTorrentsUseCase";
import { SearchTorrentsWithAiUseCase } from "../application/torrent/SearchTorrentsWithAiUseCase";
import { SetTorrentSubjectUseCase } from "../application/torrent/SetTorrentSubjectUseCase";
import { SubscribeTorrentsUseCase } from "../application/torrent/SubscribeTorrentsUseCase";
import { CheckUpdateUseCase } from "../application/update/CheckUpdateUseCase";
import { GetCurrentVersionUseCase } from "../application/update/GetCurrentVersionUseCase";
import { OpenUpdateUrlUseCase } from "../application/update/OpenUpdateUrlUseCase";
import type { AiClient } from "../domain/ai/AiClient";
import type { Logger } from "../domain/logger/logger";
import { BrowserBangumiCache } from "../infrastructure/bangumi/BrowserBangumiCache";
import { HttpBangumiRepository } from "../infrastructure/bangumi/HttpBangumiRepository";
import { HttpCollectionRepository } from "../infrastructure/collection/HttpCollectionRepository";
import { TauriCollectionRepository } from "../infrastructure/collection/TauriCollectionRepository";
import { FetchHttpClient } from "../infrastructure/http/HttpClient";
import { BrowserIptvCache } from "../infrastructure/iptv/BrowserIptvCache";
import { ConsoleLogger } from "../infrastructure/logger/ConsoleLogger";
import { HttpSettingsRepository } from "../infrastructure/settings/HttpSettingsRepository";
import { TauriSettingsRepository } from "../infrastructure/settings/TauriSettingsRepository";
import { IndexedDbCacheStore } from "../infrastructure/storage/IndexedDbCacheStore";
import { HttpTorrentRepository } from "../infrastructure/torrent/HttpTorrentRepository";
import { TauriTorrentRepository } from "../infrastructure/torrent/TauriTorrentRepository";

export interface DIContainer {
  logger: Logger;

  // UseCases
  notifyDownloadCompletionUseCase: NotifyDownloadCompletionUseCase;
  requestNotificationPermissionUseCase: RequestNotificationPermissionUseCase;
  getCollectionsUseCase: GetCollectionsUseCase;
  addFavoriteUseCase: AddFavoriteUseCase;
  removeFavoriteUseCase: RemoveFavoriteUseCase;
  getFavoriteStatusUseCase: GetFavoriteStatusUseCase;
  searchTorrentsUseCase: SearchTorrentsUseCase;
  searchTorrentsWithAiUseCase: SearchTorrentsWithAiUseCase;
  subscribeTorrentsUseCase: SubscribeTorrentsUseCase;
  pauseTorrentUseCase: PauseTorrentUseCase;
  resumeTorrentUseCase: ResumeTorrentUseCase;
  deleteTorrentUseCase: DeleteTorrentUseCase;
  setTorrentSubjectUseCase: SetTorrentSubjectUseCase;
  clearTorrentSubjectUseCase: ClearTorrentSubjectUseCase;
  resolveTorrentUseCase: ResolveTorrentUseCase;
  getTorrentStreamUrlUseCase: GetTorrentStreamUrlUseCase;
  getSubtitleVttUseCase: GetSubtitleVttUseCase;
  getVideoMetadataUseCase: GetVideoMetadataUseCase;

  getSettingsUseCase: GetSettingsUseCase;
  saveSettingsUseCase: SaveSettingsUseCase;
  selectDirectoryUseCase: SelectDirectoryUseCase;
  verifyAiConnectionUseCase: VerifyAiConnectionUseCase;
  setThemeUseCase: SetThemeUseCase;
  clearCacheUseCase: ClearCacheUseCase;
  translateSubtitleUseCase: TranslateSubtitleUseCase;
  getSubtitleTranslationsUseCase: GetSubtitleTranslationsUseCase;

  getBangumiCalendarUseCase: GetBangumiCalendarUseCase;
  getBangumiSubjectUseCase: GetBangumiSubjectUseCase;
  getBangumiEpisodesUseCase: GetBangumiEpisodesUseCase;
  getBangumiPersonsUseCase: GetBangumiPersonsUseCase;
  getBangumiCharactersUseCase: GetBangumiCharactersUseCase;
  getIptvCountriesUseCase: GetIptvCountriesUseCase;
  getIptvChannelsUseCase: GetIptvChannelsUseCase;
  resolvePlayableStreamUrlUseCase: ResolvePlayableStreamUrlUseCase;
  checkUpdateUseCase: CheckUpdateUseCase;
  getCurrentVersionUseCase: GetCurrentVersionUseCase;
  openUpdateUrlUseCase: OpenUpdateUrlUseCase;
  openUrlUseCase: OpenUrlUseCase;
}

export function createDefaultDIContainer(): DIContainer {
  const isTauri = import.meta.env.MODE !== "web";
  const cacheStore = new IndexedDbCacheStore();
  const logger = new ConsoleLogger("App");
  const httpClient = new FetchHttpClient();
  const torrentRepository = isTauri
    ? new TauriTorrentRepository()
    : new HttpTorrentRepository(httpClient);
  const settingsRepository = isTauri
    ? new TauriSettingsRepository()
    : new HttpSettingsRepository(httpClient);
  const bangumiRepository = new HttpBangumiRepository(httpClient);
  const collectionRepository = isTauri
    ? new TauriCollectionRepository()
    : new HttpCollectionRepository(httpClient);
  const notificationRepository = new NotificationRepositoryImpl();
  const openerRepository = new OpenerRepositoryImpl();
  const updateRepository = new UpdateRepositoryImpl(openerRepository);
  // 字幕翻译缓存仓储：Tauri 桌面端走 IPC → SQLite；Web 端用 NoOp 空实现（不持久化，但不影响流程）
  const subtitleTranslationRepository =
    new TauriSubtitleTranslationRepository();

  const notifyDownloadCompletionUseCase = new NotifyDownloadCompletionUseCase(
    notificationRepository,
  );
  const requestNotificationPermissionUseCase =
    new RequestNotificationPermissionUseCase(notificationRepository);
  const searchTorrentsUseCase = new SearchTorrentsUseCase(torrentRepository);

  const aiClient: AiClient = isTauri
    ? new TauriAiClient()
    : new FetchAiClient(httpClient);

  const searchTorrentsWithAiUseCase = new SearchTorrentsWithAiUseCase(
    torrentRepository,
    settingsRepository,
    aiClient,
    logger.withCategory("SearchTorrentsWithAiUseCase"),
  );
  const subscribeTorrentsUseCase = new SubscribeTorrentsUseCase(
    torrentRepository,
  );
  const pauseTorrentUseCase = new PauseTorrentUseCase(torrentRepository);
  const resumeTorrentUseCase = new ResumeTorrentUseCase(torrentRepository);
  const deleteTorrentUseCase = new DeleteTorrentUseCase(
    torrentRepository,
    subtitleTranslationRepository,
  );
  const setTorrentSubjectUseCase = new SetTorrentSubjectUseCase(
    torrentRepository,
  );
  const clearTorrentSubjectUseCase = new ClearTorrentSubjectUseCase(
    torrentRepository,
  );
  const resolveTorrentUseCase = new ResolveTorrentUseCase(torrentRepository);
  const getTorrentStreamUrlUseCase = new GetTorrentStreamUrlUseCase(
    torrentRepository,
  );
  const getSubtitleVttUseCase = new GetSubtitleVttUseCase(torrentRepository);
  const getVideoMetadataUseCase = new GetVideoMetadataUseCase(
    torrentRepository,
  );

  const getSettingsUseCase = new GetSettingsUseCase(settingsRepository);
  const saveSettingsUseCase = new SaveSettingsUseCase(settingsRepository);
  const selectDirectoryUseCase = new SelectDirectoryUseCase(settingsRepository);
  const verifyAiConnectionUseCase = new VerifyAiConnectionUseCase(aiClient);
  const setThemeUseCase = new SetThemeUseCase(settingsRepository);
  const clearCacheUseCase = new ClearCacheUseCase(cacheStore);
  const translateSubtitleUseCase = new TranslateSubtitleUseCase(
    aiClient,
    subtitleTranslationRepository,
    logger.withCategory("TranslateSubtitleUseCase"),
  );
  const getSubtitleTranslationsUseCase = new GetSubtitleTranslationsUseCase(
    subtitleTranslationRepository,
  );

  const bangumiCache = new BrowserBangumiCache(cacheStore);
  const getBangumiCalendarUseCase = new GetBangumiCalendarUseCase(
    bangumiRepository,
    bangumiCache,
  );
  const getBangumiSubjectUseCase = new GetBangumiSubjectUseCase(
    bangumiRepository,
    bangumiCache,
  );
  const getBangumiEpisodesUseCase = new GetBangumiEpisodesUseCase(
    bangumiRepository,
    bangumiCache,
  );
  const getBangumiPersonsUseCase = new GetBangumiPersonsUseCase(
    bangumiRepository,
    bangumiCache,
  );
  const getBangumiCharactersUseCase = new GetBangumiCharactersUseCase(
    bangumiRepository,
    bangumiCache,
  );
  const iptvCache = new BrowserIptvCache(cacheStore);
  const iptvRepository = new IptvRepositoryImpl(httpClient);
  const getIptvCountriesUseCase = new GetIptvCountriesUseCase(
    iptvRepository,
    iptvCache,
  );
  const getIptvChannelsUseCase = new GetIptvChannelsUseCase(
    iptvRepository,
    iptvCache,
  );
  const iptvStreamUrlRepository = new IptvStreamUrlRepositoryImpl();
  const resolvePlayableStreamUrlUseCase = new ResolvePlayableStreamUrlUseCase(
    iptvStreamUrlRepository,
  );
  const checkUpdateUseCase = new CheckUpdateUseCase(updateRepository);
  const getCurrentVersionUseCase = new GetCurrentVersionUseCase(
    updateRepository,
  );
  const openUpdateUrlUseCase = new OpenUpdateUrlUseCase(updateRepository);
  const getCollectionsUseCase = new GetCollectionsUseCase(collectionRepository);
  const addFavoriteUseCase = new AddFavoriteUseCase(collectionRepository);
  const removeFavoriteUseCase = new RemoveFavoriteUseCase(collectionRepository);
  const getFavoriteStatusUseCase = new GetFavoriteStatusUseCase(
    collectionRepository,
  );

  const openUrlUseCase = new OpenUrlUseCase(openerRepository);

  return {
    logger,

    notifyDownloadCompletionUseCase,
    requestNotificationPermissionUseCase,
    searchTorrentsUseCase,
    searchTorrentsWithAiUseCase,
    subscribeTorrentsUseCase,
    pauseTorrentUseCase,
    resumeTorrentUseCase,
    deleteTorrentUseCase,
    setTorrentSubjectUseCase,
    clearTorrentSubjectUseCase,
    resolveTorrentUseCase,
    getTorrentStreamUrlUseCase,
    getSubtitleVttUseCase,
    getVideoMetadataUseCase,

    getSettingsUseCase,
    saveSettingsUseCase,
    selectDirectoryUseCase,
    verifyAiConnectionUseCase,
    setThemeUseCase,
    clearCacheUseCase,
    translateSubtitleUseCase,
    getSubtitleTranslationsUseCase,

    getBangumiCalendarUseCase,
    getBangumiSubjectUseCase,
    getBangumiEpisodesUseCase,
    getBangumiPersonsUseCase,
    getBangumiCharactersUseCase,
    getIptvCountriesUseCase,
    getIptvChannelsUseCase,
    resolvePlayableStreamUrlUseCase,
    getCollectionsUseCase,
    addFavoriteUseCase,
    removeFavoriteUseCase,
    getFavoriteStatusUseCase,

    checkUpdateUseCase,
    getCurrentVersionUseCase,
    openUpdateUrlUseCase,
    openUrlUseCase,
  };
}

const DIContext = createContext<DIContainer | null>(null);

export const DIProvider = DIContext;

export function useDI(): DIContainer {
  const container = use(DIContext);
  if (!container) {
    throw new Error(
      "DIContainer was not provided. Make sure to wrap components with <DIProvider>",
    );
  }
  return container;
}
