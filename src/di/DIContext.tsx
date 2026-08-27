import { createContext, use } from "react";
import { FetchAiClient } from "@/infrastructure/ai/FetchAiClient";
import { TauriAiClient } from "@/infrastructure/ai/TauriAiClient";
import { TauriSubtitleTranslationRepository } from "@/infrastructure/subtitle/TauriSubtitleTranslationRepository";
import { GetAnimeCalendarUseCase } from "../application/anime/GetAnimeCalendarUseCase";
import { GetAnimeCharactersUseCase } from "../application/anime/GetAnimeCharactersUseCase";
import { GetAnimeEpisodesUseCase } from "../application/anime/GetAnimeEpisodesUseCase";
import { GetAnimePersonsUseCase } from "../application/anime/GetAnimePersonsUseCase";
import { GetAnimeRankedSubjectsUseCase } from "../application/anime/GetAnimeRankedSubjectsUseCase";
import { GetAnimeSubjectUseCase } from "../application/anime/GetAnimeSubjectUseCase";
import { GetNextSeasonAnimeUseCase } from "../application/anime/GetNextSeasonAnimeUseCase";
import { SearchAnimeSubjectsUseCase } from "../application/anime/SearchAnimeSubjectsUseCase";
import { ClearCacheUseCase } from "../application/cache/ClearCacheUseCase";
import { AddFavoriteUseCase } from "../application/collection/AddFavoriteUseCase";
import { GetCollectionsUseCase } from "../application/collection/GetCollectionsUseCase";
import { GetFavoriteStatusUseCase } from "../application/collection/GetFavoriteStatusUseCase";
import { RemoveFavoriteUseCase } from "../application/collection/RemoveFavoriteUseCase";
import { GetIptvChannelsUseCase } from "../application/iptv/GetIptvChannelsUseCase";
import { GetIptvCountriesUseCase } from "../application/iptv/GetIptvCountriesUseCase";
import { ResolvePlayableStreamUrlUseCase } from "../application/iptv/ResolvePlayableStreamUrlUseCase";
import { NotifyDownloadCompletionUseCase } from "../application/notification/NotifyDownloadCompletionUseCase";
import { OpenUrlUseCase } from "../application/opener/OpenUrlUseCase";
import { GetSettingsUseCase } from "../application/settings/GetSettingsUseCase";
import { SaveSettingsUseCase } from "../application/settings/SaveSettingsUseCase";
import { SelectDirectoryUseCase } from "../application/settings/SelectDirectoryUseCase";
import { SetThemeUseCase } from "../application/settings/SetThemeUseCase";
import { VerifyAiConnectionUseCase } from "../application/settings/VerifyAiConnectionUseCase";
import { DeleteSubtitleTranslationUseCase } from "../application/subtitle/DeleteSubtitleTranslationUseCase";
import { GetSubtitleTranslationByIdUseCase } from "../application/subtitle/GetSubtitleTranslationByIdUseCase";
import { GetSubtitleTranslationsUseCase } from "../application/subtitle/GetSubtitleTranslationsUseCase";
import { SaveSubtitleTranslationUseCase } from "../application/subtitle/SaveSubtitleTranslationUseCase";
import { TranslateSubtitleUseCase } from "../application/subtitle/TranslateSubtitleUseCase";
import { ClearTorrentSubjectUseCase } from "../application/torrent/ClearTorrentSubjectUseCase";
import { DeleteTorrentUseCase } from "../application/torrent/DeleteTorrentUseCase";
import { GetLocalIpUseCase } from "../application/torrent/GetLocalIpUseCase";
import { GetStreamPortUseCase } from "../application/torrent/GetStreamPortUseCase";
import { GetSubtitleVttUseCase } from "../application/torrent/GetSubtitleVttUseCase";
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
import { BrowserAnilistCache } from "../infrastructure/anilist/BrowserAnilistCache";
import { HttpAnilistRepository } from "../infrastructure/anilist/HttpAnilistRepository";
import { BrowserBangumiCache } from "../infrastructure/bangumi/BrowserBangumiCache";
import { HttpBangumiRepository } from "../infrastructure/bangumi/HttpBangumiRepository";
import { HttpCollectionRepository } from "../infrastructure/collection/HttpCollectionRepository";
import { TauriCollectionRepository } from "../infrastructure/collection/TauriCollectionRepository";
import { FetchHttpClient } from "../infrastructure/http/HttpClient";
import { BrowserIptvCache } from "../infrastructure/iptv/BrowserIptvCache";
import { HttpIptvRepository } from "../infrastructure/iptv/HttpIptvRepository";
import { TauriIptvStreamUrlRepository } from "../infrastructure/iptv/TauriIptvStreamUrlRepository";
import { WebIptvStreamUrlRepository } from "../infrastructure/iptv/WebIptvStreamUrlRepository";
import { ConsoleLogger } from "../infrastructure/logger/ConsoleLogger";
import { TauriNotificationRepository } from "../infrastructure/notification/TauriNotificationRepository";
import { WebNotificationRepository } from "../infrastructure/notification/WebNotificationRepository";
import { TauriOpenerRepository } from "../infrastructure/opener/TauriOpenerRepository";
import { WebOpenerRepository } from "../infrastructure/opener/WebOpenerRepository";
import { HttpSettingsRepository } from "../infrastructure/settings/HttpSettingsRepository";
import { TauriSettingsRepository } from "../infrastructure/settings/TauriSettingsRepository";
import { IndexedDbCacheStore } from "../infrastructure/storage/IndexedDbCacheStore";
import { HttpTorrentRepository } from "../infrastructure/torrent/HttpTorrentRepository";
import { TauriTorrentRepository } from "../infrastructure/torrent/TauriTorrentRepository";
import { GithubUpdateRepository } from "../infrastructure/update/GithubUpdateRepository";
import { WebUpdateRepository } from "../infrastructure/update/WebUpdateRepository";

export interface DIContainer {
  logger: Logger;

  // UseCases
  notifyDownloadCompletionUseCase: NotifyDownloadCompletionUseCase;
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
  getSubtitleVttUseCase: GetSubtitleVttUseCase;
  getStreamPortUseCase: GetStreamPortUseCase;
  getLocalIpUseCase: GetLocalIpUseCase;
  getVideoMetadataUseCase: GetVideoMetadataUseCase;

  getSettingsUseCase: GetSettingsUseCase;
  saveSettingsUseCase: SaveSettingsUseCase;
  selectDirectoryUseCase: SelectDirectoryUseCase;
  verifyAiConnectionUseCase: VerifyAiConnectionUseCase;
  setThemeUseCase: SetThemeUseCase;
  clearCacheUseCase: ClearCacheUseCase;
  translateSubtitleUseCase: TranslateSubtitleUseCase;
  getSubtitleTranslationsUseCase: GetSubtitleTranslationsUseCase;
  deleteSubtitleTranslationUseCase: DeleteSubtitleTranslationUseCase;
  saveSubtitleTranslationUseCase: SaveSubtitleTranslationUseCase;
  getSubtitleTranslationByIdUseCase: GetSubtitleTranslationByIdUseCase;

  getBangumiCalendarUseCase: GetAnimeCalendarUseCase;
  getAnilistCalendarUseCase: GetAnimeCalendarUseCase;
  getBangumiSubjectUseCase: GetAnimeSubjectUseCase;
  getBangumiEpisodesUseCase: GetAnimeEpisodesUseCase;
  getBangumiPersonsUseCase: GetAnimePersonsUseCase;
  getBangumiCharactersUseCase: GetAnimeCharactersUseCase;
  getBangumiRankedSubjectsUseCase: GetAnimeRankedSubjectsUseCase;
  searchBangumiSubjectsUseCase: SearchAnimeSubjectsUseCase;
  searchAnilistSubjectsUseCase: SearchAnimeSubjectsUseCase;
  getBangumiNextSeasonUseCase: GetNextSeasonAnimeUseCase;
  getAnilistNextSeasonUseCase: GetNextSeasonAnimeUseCase;
  getAnilistSubjectUseCase: GetAnimeSubjectUseCase;
  getAnilistEpisodesUseCase: GetAnimeEpisodesUseCase;
  getAnilistPersonsUseCase: GetAnimePersonsUseCase;
  getAnilistCharactersUseCase: GetAnimeCharactersUseCase;
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
  const notificationRepository = isTauri
    ? new TauriNotificationRepository()
    : new WebNotificationRepository();
  const openerRepository = isTauri
    ? new TauriOpenerRepository()
    : new WebOpenerRepository();
  const updateRepository = isTauri
    ? new GithubUpdateRepository(openerRepository)
    : new WebUpdateRepository();
  // 字幕翻译缓存仓储：Tauri 桌面端走 IPC → SQLite；Web 端用 NoOp 空实现（不持久化，但不影响流程）
  const subtitleTranslationRepository =
    new TauriSubtitleTranslationRepository();

  const notifyDownloadCompletionUseCase = new NotifyDownloadCompletionUseCase(
    notificationRepository,
  );
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
  const getSubtitleVttUseCase = new GetSubtitleVttUseCase(
    torrentRepository,
    subtitleTranslationRepository,
  );
  const getStreamPortUseCase = new GetStreamPortUseCase(torrentRepository);
  const getLocalIpUseCase = new GetLocalIpUseCase(torrentRepository);
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
  const deleteSubtitleTranslationUseCase = new DeleteSubtitleTranslationUseCase(
    subtitleTranslationRepository,
  );
  const saveSubtitleTranslationUseCase = new SaveSubtitleTranslationUseCase(
    subtitleTranslationRepository,
  );
  const getSubtitleTranslationByIdUseCase =
    new GetSubtitleTranslationByIdUseCase(subtitleTranslationRepository);

  const bangumiCache = new BrowserBangumiCache(cacheStore);
  const getBangumiCalendarUseCase = new GetAnimeCalendarUseCase(
    bangumiRepository,
    bangumiCache,
  );
  const anilistRepository = new HttpAnilistRepository(httpClient);
  const anilistCache = new BrowserAnilistCache(cacheStore);
  const getAnilistCalendarUseCase = new GetAnimeCalendarUseCase(
    anilistRepository,
    anilistCache,
  );
  const getAnilistSubjectUseCase = new GetAnimeSubjectUseCase(
    anilistRepository,
    anilistCache,
  );
  const getAnilistEpisodesUseCase = new GetAnimeEpisodesUseCase(
    anilistRepository,
    anilistCache,
  );
  const getAnilistPersonsUseCase = new GetAnimePersonsUseCase(
    anilistRepository,
    anilistCache,
  );
  const getAnilistCharactersUseCase = new GetAnimeCharactersUseCase(
    anilistRepository,
    anilistCache,
  );
  const getBangumiSubjectUseCase = new GetAnimeSubjectUseCase(
    bangumiRepository,
    bangumiCache,
  );
  const getBangumiEpisodesUseCase = new GetAnimeEpisodesUseCase(
    bangumiRepository,
    bangumiCache,
  );
  const getBangumiPersonsUseCase = new GetAnimePersonsUseCase(
    bangumiRepository,
    bangumiCache,
  );
  const getBangumiCharactersUseCase = new GetAnimeCharactersUseCase(
    bangumiRepository,
    bangumiCache,
  );
  const getBangumiRankedSubjectsUseCase = new GetAnimeRankedSubjectsUseCase(
    bangumiRepository,
    bangumiCache,
  );
  const getBangumiNextSeasonUseCase = new GetNextSeasonAnimeUseCase(
    bangumiRepository,
  );
  const searchBangumiSubjectsUseCase = new SearchAnimeSubjectsUseCase(
    bangumiRepository,
  );
  const searchAnilistSubjectsUseCase = new SearchAnimeSubjectsUseCase(
    anilistRepository,
  );
  const getAnilistNextSeasonUseCase = new GetNextSeasonAnimeUseCase(
    anilistRepository,
  );
  const iptvCache = new BrowserIptvCache(cacheStore);
  const iptvRepository = new HttpIptvRepository(httpClient);
  const getIptvCountriesUseCase = new GetIptvCountriesUseCase(
    iptvRepository,
    iptvCache,
  );
  const getIptvChannelsUseCase = new GetIptvChannelsUseCase(
    iptvRepository,
    iptvCache,
  );
  const iptvStreamUrlRepository = isTauri
    ? new TauriIptvStreamUrlRepository()
    : new WebIptvStreamUrlRepository();
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
    searchTorrentsUseCase,
    searchTorrentsWithAiUseCase,
    subscribeTorrentsUseCase,
    pauseTorrentUseCase,
    resumeTorrentUseCase,
    deleteTorrentUseCase,
    setTorrentSubjectUseCase,
    clearTorrentSubjectUseCase,
    resolveTorrentUseCase,
    getSubtitleVttUseCase,
    getStreamPortUseCase,
    getLocalIpUseCase,
    getVideoMetadataUseCase,

    getSettingsUseCase,
    saveSettingsUseCase,
    selectDirectoryUseCase,
    verifyAiConnectionUseCase,
    setThemeUseCase,
    clearCacheUseCase,
    translateSubtitleUseCase,
    getSubtitleTranslationsUseCase,
    deleteSubtitleTranslationUseCase,
    saveSubtitleTranslationUseCase,
    getSubtitleTranslationByIdUseCase,

    getBangumiCalendarUseCase,
    getAnilistCalendarUseCase,
    getBangumiSubjectUseCase,
    getBangumiEpisodesUseCase,
    getBangumiPersonsUseCase,
    getBangumiCharactersUseCase,
    getBangumiRankedSubjectsUseCase,
    searchBangumiSubjectsUseCase,
    searchAnilistSubjectsUseCase,
    getBangumiNextSeasonUseCase,
    getAnilistNextSeasonUseCase,
    getAnilistSubjectUseCase,
    getAnilistEpisodesUseCase,
    getAnilistPersonsUseCase,
    getAnilistCharactersUseCase,
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

export const DIContext = createContext<DIContainer | null>(null);

export function useDI(): DIContainer {
  const container = use(DIContext);
  if (!container) {
    throw new Error(
      "DIContainer was not provided. Make sure to wrap components with <DIContext>",
    );
  }
  return container;
}
