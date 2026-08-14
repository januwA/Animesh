import { createContext, use } from "react";
import {
  CollectionRepositoryImpl,
  IptvRepositoryImpl,
  IptvStreamUrlRepositoryImpl,
  NotificationRepositoryImpl,
  OpenerRepositoryImpl,
  SettingsRepositoryImpl,
  TorrentRepositoryImpl,
  UpdateRepositoryImpl,
} from "@/di/repositories";
import { FetchAiClient } from "@/infrastructure/ai/FetchAiClient";
import { TauriAiClient } from "@/infrastructure/ai/TauriAiClient";
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
import { OpenUrlUseCase } from "../application/opener/OpenUrlUseCase";
import { GetSettingsUseCase } from "../application/settings/GetSettingsUseCase";
import { SaveSettingsUseCase } from "../application/settings/SaveSettingsUseCase";
import { SelectDirectoryUseCase } from "../application/settings/SelectDirectoryUseCase";
import { SetThemeUseCase } from "../application/settings/SetThemeUseCase";
import { VerifyAiConnectionUseCase } from "../application/settings/VerifyAiConnectionUseCase";
import { AddTorrentMagnetUseCase } from "../application/torrent/AddTorrentMagnetUseCase";
import { ClearTorrentSubjectUseCase } from "../application/torrent/ClearTorrentSubjectUseCase";
import { DeleteTorrentUseCase } from "../application/torrent/DeleteTorrentUseCase";
import { GetSubtitleVttUseCase } from "../application/torrent/GetSubtitleVttUseCase";
import { GetTorrentFilesUseCase } from "../application/torrent/GetTorrentFilesUseCase";
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
import type { CollectionRepository } from "../domain/collection/CollectionRepository";
import type { Logger } from "../domain/logger/logger";
import type { NotificationRepository } from "../domain/notification/NotificationRepository";
import { BrowserBangumiCache } from "../infrastructure/bangumi/BrowserBangumiCache";
import { HttpBangumiRepository } from "../infrastructure/bangumi/HttpBangumiRepository";
import { HttpClient } from "../infrastructure/http/HttpClient";
import { BrowserIptvCache } from "../infrastructure/iptv/BrowserIptvCache";
import { ConsoleLogger } from "../infrastructure/logger/ConsoleLogger";
import { IndexedDbCacheStore } from "../infrastructure/storage/IndexedDbCacheStore";

export interface DIContainer {
  notificationRepository: NotificationRepository;
  logger: Logger;
  collectionRepository: CollectionRepository;

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
  addTorrentMagnetUseCase: AddTorrentMagnetUseCase;
  setTorrentSubjectUseCase: SetTorrentSubjectUseCase;
  clearTorrentSubjectUseCase: ClearTorrentSubjectUseCase;
  getTorrentFilesUseCase: GetTorrentFilesUseCase;
  resolveTorrentUseCase: ResolveTorrentUseCase;
  getTorrentStreamUrlUseCase: GetTorrentStreamUrlUseCase;
  getSubtitleVttUseCase: GetSubtitleVttUseCase;
  getVideoMetadataUseCase: GetVideoMetadataUseCase;

  getSettingsUseCase: GetSettingsUseCase;
  saveSettingsUseCase: SaveSettingsUseCase;
  selectDirectoryUseCase: SelectDirectoryUseCase;
  verifyAiConnectionUseCase: VerifyAiConnectionUseCase;
  setThemeUseCase: SetThemeUseCase;
  aiClient: AiClient;
  clearCacheUseCase: ClearCacheUseCase;

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
  const torrentRepository = new TorrentRepositoryImpl();
  const settingsRepository = new SettingsRepositoryImpl();
  const httpClient = new HttpClient();
  const bangumiRepository = new HttpBangumiRepository(httpClient);
  const collectionRepository = new CollectionRepositoryImpl();
  const notificationRepository = new NotificationRepositoryImpl();
  const openerRepository = new OpenerRepositoryImpl();
  const updateRepository = new UpdateRepositoryImpl(openerRepository);

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
  const deleteTorrentUseCase = new DeleteTorrentUseCase(torrentRepository);
  const addTorrentMagnetUseCase = new AddTorrentMagnetUseCase(
    torrentRepository,
  );
  const setTorrentSubjectUseCase = new SetTorrentSubjectUseCase(
    torrentRepository,
  );
  const clearTorrentSubjectUseCase = new ClearTorrentSubjectUseCase(
    torrentRepository,
  );
  const getTorrentFilesUseCase = new GetTorrentFilesUseCase(torrentRepository);
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
    collectionRepository,
    notificationRepository,
    logger,

    notifyDownloadCompletionUseCase,
    searchTorrentsUseCase,
    searchTorrentsWithAiUseCase,
    subscribeTorrentsUseCase,
    pauseTorrentUseCase,
    resumeTorrentUseCase,
    deleteTorrentUseCase,
    addTorrentMagnetUseCase,
    setTorrentSubjectUseCase,
    clearTorrentSubjectUseCase,
    getTorrentFilesUseCase,
    resolveTorrentUseCase,
    getTorrentStreamUrlUseCase,
    getSubtitleVttUseCase,
    getVideoMetadataUseCase,

    getSettingsUseCase,
    saveSettingsUseCase,
    selectDirectoryUseCase,
    verifyAiConnectionUseCase,
    setThemeUseCase,
    aiClient,
    clearCacheUseCase,

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
