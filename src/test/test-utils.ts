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
import type { DIContainer } from "../di/DIContext";
import type { AiClient } from "../domain/ai/AiClient";
import type { BangumiCache } from "../domain/bangumi/BangumiCache";
import type { BangumiRepository } from "../domain/bangumi/BangumiRepository";
import type { CollectionRepository } from "../domain/collection/CollectionRepository";
import type { IptvCache } from "../domain/iptv/IptvCache";
import type { IptvRepository } from "../domain/iptv/IptvRepository";
import type { IptvStreamUrlRepository } from "../domain/iptv/IptvStreamUrlRepository";
import type { Logger } from "../domain/logger/logger";
import type { NotificationRepository } from "../domain/notification/NotificationRepository";
import type { OpenerRepository } from "../domain/opener/OpenerRepository";
import type { SettingsRepository } from "../domain/settings/SettingsRepository";
import type { TorrentRepository } from "../domain/torrent/TorrentRepository";
import type { UpdateRepository } from "../domain/update/UpdateRepository";
import { FetchAiClient } from "../infrastructure/ai/FetchAiClient";
import { HttpClient } from "../infrastructure/http/HttpClient";
import { InMemoryCacheStore } from "./InMemoryCacheStore";

const dummyLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  withCategory: () => dummyLogger,
};

export interface CreateContainerParamsForTest {
  torrentRepository?: Partial<TorrentRepository>;
  settingsRepository?: Partial<SettingsRepository>;
  collectionRepository?: Partial<CollectionRepository>;
  bangumiRepository?: Partial<BangumiRepository>;
  bangumiCache?: Partial<BangumiCache>;
  notificationRepository?: Partial<NotificationRepository>;
  logger?: Logger;

  notifyDownloadCompletionUseCase?: NotifyDownloadCompletionUseCase;
  searchTorrentsUseCase?: SearchTorrentsUseCase;
  searchTorrentsWithAiUseCase?: SearchTorrentsWithAiUseCase;
  subscribeTorrentsUseCase?: SubscribeTorrentsUseCase;
  pauseTorrentUseCase?: PauseTorrentUseCase;
  resumeTorrentUseCase?: ResumeTorrentUseCase;
  deleteTorrentUseCase?: DeleteTorrentUseCase;
  addTorrentMagnetUseCase?: AddTorrentMagnetUseCase;
  setTorrentSubjectUseCase?: SetTorrentSubjectUseCase;
  clearTorrentSubjectUseCase?: ClearTorrentSubjectUseCase;
  getTorrentFilesUseCase?: GetTorrentFilesUseCase;
  resolveTorrentUseCase?: ResolveTorrentUseCase;
  getTorrentStreamUrlUseCase?: GetTorrentStreamUrlUseCase;
  getSubtitleVttUseCase?: GetSubtitleVttUseCase;
  getVideoMetadataUseCase?: GetVideoMetadataUseCase;

  getSettingsUseCase?: GetSettingsUseCase;
  saveSettingsUseCase?: SaveSettingsUseCase;
  selectDirectoryUseCase?: SelectDirectoryUseCase;
  verifyAiConnectionUseCase?: VerifyAiConnectionUseCase;
  setThemeUseCase?: SetThemeUseCase;
  aiClient?: AiClient;
  clearCacheUseCase?: ClearCacheUseCase;

  getBangumiCalendarUseCase?: GetBangumiCalendarUseCase;
  getBangumiSubjectUseCase?: GetBangumiSubjectUseCase;
  getBangumiEpisodesUseCase?: GetBangumiEpisodesUseCase;
  getBangumiPersonsUseCase?: GetBangumiPersonsUseCase;
  getBangumiCharactersUseCase?: GetBangumiCharactersUseCase;
  iptvRepository?: Partial<IptvRepository>;
  iptvCache?: Partial<IptvCache>;
  iptvStreamUrlRepository?: Partial<IptvStreamUrlRepository>;
  getIptvCountriesUseCase?: GetIptvCountriesUseCase;
  getIptvChannelsUseCase?: GetIptvChannelsUseCase;
  updateRepository?: Partial<UpdateRepository>;
  getCollectionsUseCase?: GetCollectionsUseCase;
  addFavoriteUseCase?: AddFavoriteUseCase;
  removeFavoriteUseCase?: RemoveFavoriteUseCase;
  getFavoriteStatusUseCase?: GetFavoriteStatusUseCase;
  checkUpdateUseCase?: CheckUpdateUseCase;
  getCurrentVersionUseCase?: GetCurrentVersionUseCase;
  openUpdateUrlUseCase?: OpenUpdateUrlUseCase;
  openerRepository?: Partial<OpenerRepository>;
  openUrlUseCase?: OpenUrlUseCase;
}

export function createDIContainerForTest(
  params: CreateContainerParamsForTest,
): DIContainer {
  const torrentRepo = {
    search: async () => [],
    pauseTorrent: async () => {},
    resumeTorrent: async () => {},
    deleteTorrent: async () => {},
    addTorrentMagnet: async () => ({ info_hash: "", name: "", files: [] }),
    getTorrentFiles: async () => [],
    getTorrentStreamUrl: async () => "",
    getSubtitleVtt: async () => "",
    getVideoMetadata: async () => ({
      tracks: [],
      chapters: [],
      video_info: {
        date_utc: null,
        muxing_app: "",
        writing_app: "",
        video_tracks: [],
        audio_tracks: [],
      },
    }),
    subscribeTorrents: async (onUpdate: (list: any[]) => void) => {
      onUpdate([]);
      return () => {};
    },
    setTorrentSubject: async () => {},
    clearTorrentSubject: async () => {},
    ...params.torrentRepository,
  } as unknown as TorrentRepository;

  const settingsRepo = {
    getSettings: async () => ({ download_dir: "" }),
    setDownloadDir: async () => {},
    setProxy: async () => {},
    setAiOptions: async () => {},
    selectDirectory: async () => null,
    setTheme: async () => {},
    ...params.settingsRepository,
  } as SettingsRepository;

  const bangumiRepo = {
    getCalendar: async () => [],
    getSubject: async () => ({}) as any,
    getEpisodes: async () => ({ items: [], total: 0 }),
    getSubjectPersons: async () => [],
    getSubjectCharacters: async () => [],
    ...params.bangumiRepository,
  } as BangumiRepository;

  const bangumiCache = {
    getCalendar: async () => null,
    setCalendar: async () => {},
    getSubject: async () => null,
    setSubject: async () => {},
    getEpisodes: async () => null,
    setEpisodes: async () => {},
    getPersons: async () => null,
    setPersons: async () => {},
    getCharacters: async () => null,
    setCharacters: async () => {},
    ...params.bangumiCache,
  } as BangumiCache;

  const iptvRepo = {
    getCountries: async () => [],
    getChannels: async () => [],
    ...params.iptvRepository,
  } as IptvRepository;

  const iptvCache = {
    getCountries: async () => null,
    setCountries: async () => {},
    getChannels: async () => null,
    setChannels: async () => {},
    ...params.iptvCache,
  } as IptvCache;

  const iptvStreamUrlRepo = {
    resolvePlayableStreamUrl: async (rawUrl: string) => ({
      url: rawUrl,
      kind: "unknown" as const,
    }),
    ...params.iptvStreamUrlRepository,
  } as IptvStreamUrlRepository;

  const notificationRepo = {
    requestPermission: async () => false,
    sendNotification: async () => {},
    ...params.notificationRepository,
  } as NotificationRepository;

  const collectionRepo = {
    getAll: async () => [],
    isFavorited: async () => false,
    add: async () => {},
    remove: async () => {},
    ...params.collectionRepository,
  } as CollectionRepository;

  const updateRepo = {
    getLatestRelease: async () => ({
      version: "0.0.0",
      notes: "",
      htmlUrl: "",
    }),
    getCurrentVersion: async () => "0.0.0",
    openUrl: async () => {},
    ...params.updateRepository,
  } as unknown as UpdateRepository;

  const openerRepo = {
    openUrl: async () => {},
    ...params.openerRepository,
  } as OpenerRepository;

  const notifyUseCase =
    params.notifyDownloadCompletionUseCase ||
    new NotifyDownloadCompletionUseCase(notificationRepo);

  const searchTorrentsUseCase =
    params.searchTorrentsUseCase || new SearchTorrentsUseCase(torrentRepo);
  const searchTorrentsWithAiUseCase =
    params.searchTorrentsWithAiUseCase ||
    new SearchTorrentsWithAiUseCase(
      torrentRepo,
      settingsRepo,
      new FetchAiClient(new HttpClient()),
      dummyLogger,
    );
  const subscribeTorrentsUseCase =
    params.subscribeTorrentsUseCase ||
    new SubscribeTorrentsUseCase(torrentRepo);
  const pauseTorrentUseCase =
    params.pauseTorrentUseCase || new PauseTorrentUseCase(torrentRepo);
  const resumeTorrentUseCase =
    params.resumeTorrentUseCase || new ResumeTorrentUseCase(torrentRepo);
  const deleteTorrentUseCase =
    params.deleteTorrentUseCase || new DeleteTorrentUseCase(torrentRepo);
  const addTorrentMagnetUseCase =
    params.addTorrentMagnetUseCase || new AddTorrentMagnetUseCase(torrentRepo);
  const setTorrentSubjectUseCase =
    params.setTorrentSubjectUseCase ||
    new SetTorrentSubjectUseCase(torrentRepo);
  const clearTorrentSubjectUseCase =
    params.clearTorrentSubjectUseCase ||
    new ClearTorrentSubjectUseCase(torrentRepo);
  const getTorrentFilesUseCase =
    params.getTorrentFilesUseCase || new GetTorrentFilesUseCase(torrentRepo);
  const resolveTorrentUseCase =
    params.resolveTorrentUseCase || new ResolveTorrentUseCase(torrentRepo);
  const getTorrentStreamUrlUseCase =
    params.getTorrentStreamUrlUseCase ||
    new GetTorrentStreamUrlUseCase(torrentRepo);
  const getSubtitleVttUseCase =
    params.getSubtitleVttUseCase || new GetSubtitleVttUseCase(torrentRepo);
  const getVideoMetadataUseCase =
    params.getVideoMetadataUseCase || new GetVideoMetadataUseCase(torrentRepo);

  const getSettingsUseCase =
    params.getSettingsUseCase || new GetSettingsUseCase(settingsRepo);
  const saveSettingsUseCase =
    params.saveSettingsUseCase || new SaveSettingsUseCase(settingsRepo);
  const selectDirectoryUseCase =
    params.selectDirectoryUseCase || new SelectDirectoryUseCase(settingsRepo);
  const aiClient = params.aiClient || new FetchAiClient(new HttpClient());
  const verifyAiConnectionUseCase =
    params.verifyAiConnectionUseCase || new VerifyAiConnectionUseCase(aiClient);
  const setThemeUseCase =
    params.setThemeUseCase || new SetThemeUseCase(settingsRepo);
  const clearCacheUseCase =
    params.clearCacheUseCase || new ClearCacheUseCase(new InMemoryCacheStore());

  const getBangumiCalendarUseCase =
    params.getBangumiCalendarUseCase ||
    new GetBangumiCalendarUseCase(bangumiRepo, bangumiCache);

  const getBangumiSubjectUseCase =
    params.getBangumiSubjectUseCase ||
    new GetBangumiSubjectUseCase(bangumiRepo, bangumiCache);

  const getBangumiEpisodesUseCase =
    params.getBangumiEpisodesUseCase ||
    new GetBangumiEpisodesUseCase(bangumiRepo, bangumiCache);

  const getBangumiPersonsUseCase =
    params.getBangumiPersonsUseCase ||
    new GetBangumiPersonsUseCase(bangumiRepo, bangumiCache);

  const getBangumiCharactersUseCase =
    params.getBangumiCharactersUseCase ||
    new GetBangumiCharactersUseCase(bangumiRepo, bangumiCache);

  const getIptvCountriesUseCase =
    params.getIptvCountriesUseCase ||
    new GetIptvCountriesUseCase(iptvRepo, iptvCache);
  const getIptvChannelsUseCase =
    params.getIptvChannelsUseCase ||
    new GetIptvChannelsUseCase(iptvRepo, iptvCache);

  const resolvePlayableStreamUrlUseCase = new ResolvePlayableStreamUrlUseCase(
    iptvStreamUrlRepo,
  );

  const checkUpdateUseCase =
    params.checkUpdateUseCase || new CheckUpdateUseCase(updateRepo);
  const getCurrentVersionUseCase =
    params.getCurrentVersionUseCase || new GetCurrentVersionUseCase(updateRepo);
  const openUpdateUrlUseCase =
    params.openUpdateUrlUseCase || new OpenUpdateUrlUseCase(updateRepo);
  const openUrlUseCase =
    params.openUrlUseCase || new OpenUrlUseCase(openerRepo);

  const getCollectionsUseCase =
    params.getCollectionsUseCase || new GetCollectionsUseCase(collectionRepo);
  const addFavoriteUseCase =
    params.addFavoriteUseCase || new AddFavoriteUseCase(collectionRepo);
  const removeFavoriteUseCase =
    params.removeFavoriteUseCase || new RemoveFavoriteUseCase(collectionRepo);
  const getFavoriteStatusUseCase =
    params.getFavoriteStatusUseCase ||
    new GetFavoriteStatusUseCase(collectionRepo);

  return {
    collectionRepository: collectionRepo,
    notificationRepository: notificationRepo,
    logger: params.logger || dummyLogger,

    getCollectionsUseCase,
    addFavoriteUseCase,
    removeFavoriteUseCase,
    getFavoriteStatusUseCase,
    notifyDownloadCompletionUseCase: notifyUseCase,
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
    checkUpdateUseCase,
    getCurrentVersionUseCase,
    openUpdateUrlUseCase,
    openUrlUseCase,
  };
}
