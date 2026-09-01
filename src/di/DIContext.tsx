import { createContext, use } from "react";
import type { HttpClient } from "@/domain/http/HttpClient";
import type { CacheStore } from "@/domain/storage/CacheStore";
import { FetchAiClient } from "@/infrastructure/ai/FetchAiClient";
import { TauriAiClient } from "@/infrastructure/ai/TauriAiClient";
import { TauriSubtitleTranslationRepository } from "@/infrastructure/subtitle/TauriSubtitleTranslationRepository";
import { GetAnimeCalendarUseCase } from "../application/anime/GetAnimeCalendarUseCase";
import { GetAnimeCharactersUseCase } from "../application/anime/GetAnimeCharactersUseCase";
import { GetAnimeEpisodesUseCase } from "../application/anime/GetAnimeEpisodesUseCase";
import { GetAnimePersonsUseCase } from "../application/anime/GetAnimePersonsUseCase";
import { GetAnimeSubjectUseCase } from "../application/anime/GetAnimeSubjectUseCase";
import { GetNextSeasonAnimeUseCase } from "../application/anime/GetNextSeasonAnimeUseCase";
import { GetWallpaperImagesUseCase } from "../application/anime/GetWallpaperImagesUseCase";
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
import { GetAiConfigsUseCase } from "../application/settings/GetAiConfigsUseCase";
import { GetDownloadDirUseCase } from "../application/settings/GetDownloadDirUseCase";
import { GetProxyUseCase } from "../application/settings/GetProxyUseCase";
import { GetSettingsUseCase } from "../application/settings/GetSettingsUseCase";
import { GetSpeedLimitsUseCase } from "../application/settings/GetSpeedLimitsUseCase";
import { GetTranslationConfigUseCase } from "../application/settings/GetTranslationConfigUseCase";
import { SelectDirectoryUseCase } from "../application/settings/SelectDirectoryUseCase";
import { SetAiConfigsUseCase } from "../application/settings/SetAiConfigsUseCase";
import { SetDownloadDirUseCase } from "../application/settings/SetDownloadDirUseCase";
import { SetProxyUseCase } from "../application/settings/SetProxyUseCase";
import { SetSpeedLimitsUseCase } from "../application/settings/SetSpeedLimitsUseCase";
import { SetThemeUseCase } from "../application/settings/SetThemeUseCase";
import { SetTranslationConfigUseCase } from "../application/settings/SetTranslationConfigUseCase";
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
import { SetTorrentSubjectUseCase } from "../application/torrent/SetTorrentSubjectUseCase";
import { SubscribeTorrentsUseCase } from "../application/torrent/SubscribeTorrentsUseCase";
import { TranslateTextUseCase } from "../application/translation/TranslateTextUseCase";
import { CheckUpdateUseCase } from "../application/update/CheckUpdateUseCase";
import { GetCurrentVersionUseCase } from "../application/update/GetCurrentVersionUseCase";
import { OpenUpdateUrlUseCase } from "../application/update/OpenUpdateUrlUseCase";
import type { AiClient } from "../domain/ai/AiClient";
import type { Logger } from "../domain/logger/logger";
import { HttpAnilistRepository } from "../infrastructure/anilist/HttpAnilistRepository";
import { HttpBangumiRepository } from "../infrastructure/bangumi/HttpBangumiRepository";
import { HttpCollectionRepository } from "../infrastructure/collection/HttpCollectionRepository";
import { TauriCollectionRepository } from "../infrastructure/collection/TauriCollectionRepository";
import { HttpIptvRepository } from "../infrastructure/iptv/HttpIptvRepository";
import { TauriIptvStreamUrlRepository } from "../infrastructure/iptv/TauriIptvStreamUrlRepository";
import { WebIptvStreamUrlRepository } from "../infrastructure/iptv/WebIptvStreamUrlRepository";
import { TauriNotificationRepository } from "../infrastructure/notification/TauriNotificationRepository";
import { WebNotificationRepository } from "../infrastructure/notification/WebNotificationRepository";
import { TauriOpenerRepository } from "../infrastructure/opener/TauriOpenerRepository";
import { WebOpenerRepository } from "../infrastructure/opener/WebOpenerRepository";
import { HttpSettingsRepository } from "../infrastructure/settings/HttpSettingsRepository";
import { TauriSettingsRepository } from "../infrastructure/settings/TauriSettingsRepository";
import { HttpTorrentRepository } from "../infrastructure/torrent/HttpTorrentRepository";
import { TauriTorrentRepository } from "../infrastructure/torrent/TauriTorrentRepository";
import { AiTranslateClient } from "../infrastructure/translation/AiTranslateClient";
import { GoogleTranslateClient } from "../infrastructure/translation/GoogleTranslateClient";
import { IndexedDbTranslationCache } from "../infrastructure/translation/IndexedDbTranslationCache";
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
  selectDirectoryUseCase: SelectDirectoryUseCase;
  verifyAiConnectionUseCase: VerifyAiConnectionUseCase;
  setThemeUseCase: SetThemeUseCase;
  getDownloadDirUseCase: GetDownloadDirUseCase;
  setDownloadDirUseCase: SetDownloadDirUseCase;
  getSpeedLimitsUseCase: GetSpeedLimitsUseCase;
  setSpeedLimitsUseCase: SetSpeedLimitsUseCase;
  getProxyUseCase: GetProxyUseCase;
  setProxyUseCase: SetProxyUseCase;
  getAiConfigsUseCase: GetAiConfigsUseCase;
  setAiConfigsUseCase: SetAiConfigsUseCase;
  getTranslationConfigUseCase: GetTranslationConfigUseCase;
  setTranslationConfigUseCase: SetTranslationConfigUseCase;
  clearCacheUseCase: ClearCacheUseCase;
  translateSubtitleUseCase: TranslateSubtitleUseCase;
  getSubtitleTranslationsUseCase: GetSubtitleTranslationsUseCase;
  deleteSubtitleTranslationUseCase: DeleteSubtitleTranslationUseCase;
  saveSubtitleTranslationUseCase: SaveSubtitleTranslationUseCase;
  getSubtitleTranslationByIdUseCase: GetSubtitleTranslationByIdUseCase;
  translateTextUseCase: TranslateTextUseCase;

  getBangumiCalendarUseCase: GetAnimeCalendarUseCase;
  getAnilistCalendarUseCase: GetAnimeCalendarUseCase;
  getBangumiSubjectUseCase: GetAnimeSubjectUseCase;
  getBangumiEpisodesUseCase: GetAnimeEpisodesUseCase;
  getBangumiPersonsUseCase: GetAnimePersonsUseCase;
  getBangumiCharactersUseCase: GetAnimeCharactersUseCase;
  getWallpaperImagesUseCase: GetWallpaperImagesUseCase;
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

export function createDIContainer({
  logger,
  cacheStore,
  httpClient,
}: {
  logger: Logger;
  cacheStore: CacheStore;
  httpClient: HttpClient;
}): DIContainer {
  const isTauri = import.meta.env.MODE !== "web";
  const torrentRepository = isTauri
    ? new TauriTorrentRepository(httpClient, cacheStore)
    : new HttpTorrentRepository(httpClient, cacheStore);
  const settingsRepository = isTauri
    ? new TauriSettingsRepository()
    : new HttpSettingsRepository(httpClient);
  const bangumiRepository = new HttpBangumiRepository(httpClient, cacheStore);
  const collectionRepository = isTauri
    ? new TauriCollectionRepository(cacheStore)
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
  const subtitleTranslationRepository =
    new TauriSubtitleTranslationRepository();

  const notifyDownloadCompletionUseCase = new NotifyDownloadCompletionUseCase(
    notificationRepository,
  );
  const searchTorrentsUseCase = new SearchTorrentsUseCase(torrentRepository);

  const aiClient: AiClient = isTauri
    ? new TauriAiClient(httpClient)
    : new FetchAiClient(httpClient);

  const googleTranslateClient = new GoogleTranslateClient();
  const aiTranslateClient = new AiTranslateClient(aiClient);
  const translationCache = new IndexedDbTranslationCache(cacheStore);
  const translateTextUseCase = new TranslateTextUseCase(
    googleTranslateClient,
    aiTranslateClient,
    translationCache,
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
  const selectDirectoryUseCase = new SelectDirectoryUseCase(settingsRepository);
  const verifyAiConnectionUseCase = new VerifyAiConnectionUseCase(aiClient);
  const setThemeUseCase = new SetThemeUseCase(settingsRepository);
  const getDownloadDirUseCase = new GetDownloadDirUseCase(settingsRepository);
  const setDownloadDirUseCase = new SetDownloadDirUseCase(settingsRepository);
  const getSpeedLimitsUseCase = new GetSpeedLimitsUseCase(settingsRepository);
  const setSpeedLimitsUseCase = new SetSpeedLimitsUseCase(settingsRepository);
  const getProxyUseCase = new GetProxyUseCase(settingsRepository);
  const setProxyUseCase = new SetProxyUseCase(settingsRepository);
  const getAiConfigsUseCase = new GetAiConfigsUseCase(settingsRepository);
  const setAiConfigsUseCase = new SetAiConfigsUseCase(settingsRepository);
  const getTranslationConfigUseCase = new GetTranslationConfigUseCase(
    settingsRepository,
  );
  const setTranslationConfigUseCase = new SetTranslationConfigUseCase(
    settingsRepository,
  );
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

  const getBangumiCalendarUseCase = new GetAnimeCalendarUseCase(
    bangumiRepository,
  );
  const anilistRepository = new HttpAnilistRepository(httpClient, cacheStore);
  const getAnilistCalendarUseCase = new GetAnimeCalendarUseCase(
    anilistRepository,
  );
  const getAnilistSubjectUseCase = new GetAnimeSubjectUseCase(
    anilistRepository,
  );
  const getAnilistEpisodesUseCase = new GetAnimeEpisodesUseCase(
    anilistRepository,
  );
  const getAnilistPersonsUseCase = new GetAnimePersonsUseCase(
    anilistRepository,
  );
  const getAnilistCharactersUseCase = new GetAnimeCharactersUseCase(
    anilistRepository,
  );
  const getBangumiSubjectUseCase = new GetAnimeSubjectUseCase(
    bangumiRepository,
  );
  const getBangumiEpisodesUseCase = new GetAnimeEpisodesUseCase(
    bangumiRepository,
  );
  const getBangumiPersonsUseCase = new GetAnimePersonsUseCase(
    bangumiRepository,
  );
  const getBangumiCharactersUseCase = new GetAnimeCharactersUseCase(
    bangumiRepository,
  );
  const getWallpaperImagesUseCase = new GetWallpaperImagesUseCase(
    bangumiRepository,
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
  const iptvRepository = new HttpIptvRepository(httpClient, cacheStore);
  const getIptvCountriesUseCase = new GetIptvCountriesUseCase(iptvRepository);
  const getIptvChannelsUseCase = new GetIptvChannelsUseCase(iptvRepository);
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
    selectDirectoryUseCase,
    verifyAiConnectionUseCase,
    setThemeUseCase,
    getDownloadDirUseCase,
    setDownloadDirUseCase,
    getSpeedLimitsUseCase,
    setSpeedLimitsUseCase,
    getProxyUseCase,
    setProxyUseCase,
    getAiConfigsUseCase,
    setAiConfigsUseCase,
    getTranslationConfigUseCase,
    setTranslationConfigUseCase,
    clearCacheUseCase,
    translateSubtitleUseCase,
    getSubtitleTranslationsUseCase,
    deleteSubtitleTranslationUseCase,
    saveSubtitleTranslationUseCase,
    getSubtitleTranslationByIdUseCase,
    translateTextUseCase,

    getBangumiCalendarUseCase,
    getAnilistCalendarUseCase,
    getBangumiSubjectUseCase,
    getBangumiEpisodesUseCase,
    getBangumiPersonsUseCase,
    getBangumiCharactersUseCase,
    getWallpaperImagesUseCase,
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
