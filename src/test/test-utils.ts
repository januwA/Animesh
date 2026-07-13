import { GetBangumiCalendarUseCase } from "../application/bangumi/GetBangumiCalendarUseCase";
import { GetBangumiEpisodesUseCase } from "../application/bangumi/GetBangumiEpisodesUseCase";
import { GetBangumiSubjectUseCase } from "../application/bangumi/GetBangumiSubjectUseCase";
import { NotifyDownloadCompletionUseCase } from "../application/notification/NotifyDownloadCompletionUseCase";
import { OpenUrlUseCase } from "../application/opener/OpenUrlUseCase";
import { AutoUpdateTrackersUseCase } from "../application/settings/AutoUpdateTrackersUseCase";
import { GetSettingsUseCase } from "../application/settings/GetSettingsUseCase";
import { SaveSettingsUseCase } from "../application/settings/SaveSettingsUseCase";
import { SelectDirectoryUseCase } from "../application/settings/SelectDirectoryUseCase";
import { SyncTrackersUseCase } from "../application/settings/SyncTrackersUseCase";
import { VerifyAiConnectionUseCase } from "../application/settings/VerifyAiConnectionUseCase";
import { AddTorrentMagnetUseCase } from "../application/torrent/AddTorrentMagnetUseCase";
import { DeleteTorrentUseCase } from "../application/torrent/DeleteTorrentUseCase";
import { GetSubtitleTracksUseCase } from "../application/torrent/GetSubtitleTracksUseCase";
import { GetSubtitleVttUseCase } from "../application/torrent/GetSubtitleVttUseCase";
import { GetTorrentFilesUseCase } from "../application/torrent/GetTorrentFilesUseCase";
import { GetTorrentStatusUseCase } from "../application/torrent/GetTorrentStatusUseCase";
import { GetTorrentStreamUrlUseCase } from "../application/torrent/GetTorrentStreamUrlUseCase";
import { ListTorrentsUseCase } from "../application/torrent/ListTorrentsUseCase";
import { PauseTorrentUseCase } from "../application/torrent/PauseTorrentUseCase";
import { ResolveTorrentUseCase } from "../application/torrent/ResolveTorrentUseCase";
import { ResumeTorrentUseCase } from "../application/torrent/ResumeTorrentUseCase";
import { SearchTorrentsUseCase } from "../application/torrent/SearchTorrentsUseCase";
import { SearchTorrentsWithAiUseCase } from "../application/torrent/SearchTorrentsWithAiUseCase";
import { SubscribeTorrentsUseCase } from "../application/torrent/SubscribeTorrentsUseCase";
import { CheckUpdateUseCase } from "../application/update/CheckUpdateUseCase";
import { GetCurrentVersionUseCase } from "../application/update/GetCurrentVersionUseCase";
import { OpenUpdateUrlUseCase } from "../application/update/OpenUpdateUrlUseCase";
import type { DIContainer } from "../di/DIContext";
import type { AiClient } from "../domain/ai/AiClient";
import type { BangumiRepository } from "../domain/bangumi/BangumiRepository";
import type { Logger } from "../domain/logger/logger";
import type { NotificationRepository } from "../domain/notification/NotificationRepository";
import type { OpenerRepository } from "../domain/opener/OpenerRepository";
import type { SettingsRepository } from "../domain/settings/SettingsRepository";
import type { TorrentRepository } from "../domain/torrent/TorrentRepository";
import type { UpdateRepository } from "../domain/update/UpdateRepository";
import { FetchAiClient } from "../infrastructure/ai/FetchAiClient";
import { HttpClient } from "../infrastructure/http/HttpClient";

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
	bangumiRepository?: Partial<BangumiRepository>;
	notificationRepository?: Partial<NotificationRepository>;
	logger?: Logger;

	notifyDownloadCompletionUseCase?: NotifyDownloadCompletionUseCase;
	searchTorrentsUseCase?: SearchTorrentsUseCase;
	searchTorrentsWithAiUseCase?: SearchTorrentsWithAiUseCase;
	listTorrentsUseCase?: ListTorrentsUseCase;
	subscribeTorrentsUseCase?: SubscribeTorrentsUseCase;
	pauseTorrentUseCase?: PauseTorrentUseCase;
	resumeTorrentUseCase?: ResumeTorrentUseCase;
	deleteTorrentUseCase?: DeleteTorrentUseCase;
	addTorrentMagnetUseCase?: AddTorrentMagnetUseCase;
	getTorrentFilesUseCase?: GetTorrentFilesUseCase;
	resolveTorrentUseCase?: ResolveTorrentUseCase;
	getTorrentStatusUseCase?: GetTorrentStatusUseCase;
	getTorrentStreamUrlUseCase?: GetTorrentStreamUrlUseCase;
	getSubtitleTracksUseCase?: GetSubtitleTracksUseCase;
	getSubtitleVttUseCase?: GetSubtitleVttUseCase;

	getSettingsUseCase?: GetSettingsUseCase;
	saveSettingsUseCase?: SaveSettingsUseCase;
	selectDirectoryUseCase?: SelectDirectoryUseCase;
	syncTrackersUseCase?: SyncTrackersUseCase;
	autoUpdateTrackersUseCase?: AutoUpdateTrackersUseCase;
	verifyAiConnectionUseCase?: VerifyAiConnectionUseCase;
	aiClient?: AiClient;

	getBangumiCalendarUseCase?: GetBangumiCalendarUseCase;
	getBangumiSubjectUseCase?: GetBangumiSubjectUseCase;
	getBangumiEpisodesUseCase?: GetBangumiEpisodesUseCase;
	updateRepository?: Partial<UpdateRepository>;
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
		listTorrents: async () => [],
		pauseTorrent: async () => {},
		resumeTorrent: async () => {},
		deleteTorrent: async () => {},
		addTorrentMagnet: async () => ({ info_hash: "", name: "", files: [] }),
		getTorrentFiles: async () => [],
		getTorrentStreamUrl: async () => "",
		getTorrentStatus: async () => ({}) as any,
		getSubtitleTracks: async () => [],
		getSubtitleVtt: async () => "",
		subscribeTorrents: async (onUpdate: (list: any[]) => void) => {
			onUpdate([]);
			return () => {};
		},
		...params.torrentRepository,
	} as unknown as TorrentRepository;

	const settingsRepo = {
		getSettings: async () => ({ download_dir: "", trackers: [] }),
		setDownloadDir: async () => {},
		setProxy: async () => {},
		setTrackers: async () => {},
		setTrackerOptions: async () => {},
		setAiOptions: async () => {},
		fetchTrackers: async () => [],
		selectDirectory: async () => null,
		...params.settingsRepository,
	} as SettingsRepository;

	const bangumiRepo = {
		getCalendar: async () => [],
		getSubject: async () => ({}) as any,
		getEpisodes: async () => [],
		...params.bangumiRepository,
	} as BangumiRepository;

	const notificationRepo = {
		requestPermission: async () => false,
		sendNotification: async () => {},
		...params.notificationRepository,
	} as NotificationRepository;

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
		new NotifyDownloadCompletionUseCase(torrentRepo, notificationRepo);

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
	const listTorrentsUseCase =
		params.listTorrentsUseCase || new ListTorrentsUseCase(torrentRepo);
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
	const getTorrentFilesUseCase =
		params.getTorrentFilesUseCase || new GetTorrentFilesUseCase(torrentRepo);
	const resolveTorrentUseCase =
		params.resolveTorrentUseCase || new ResolveTorrentUseCase(torrentRepo);
	const getTorrentStatusUseCase =
		params.getTorrentStatusUseCase || new GetTorrentStatusUseCase(torrentRepo);
	const getTorrentStreamUrlUseCase =
		params.getTorrentStreamUrlUseCase ||
		new GetTorrentStreamUrlUseCase(torrentRepo);
	const getSubtitleTracksUseCase =
		params.getSubtitleTracksUseCase ||
		new GetSubtitleTracksUseCase(torrentRepo);
	const getSubtitleVttUseCase =
		params.getSubtitleVttUseCase || new GetSubtitleVttUseCase(torrentRepo);

	const getSettingsUseCase =
		params.getSettingsUseCase || new GetSettingsUseCase(settingsRepo);
	const saveSettingsUseCase =
		params.saveSettingsUseCase || new SaveSettingsUseCase(settingsRepo);
	const selectDirectoryUseCase =
		params.selectDirectoryUseCase || new SelectDirectoryUseCase(settingsRepo);
	const syncTrackersUseCase =
		params.syncTrackersUseCase || new SyncTrackersUseCase(settingsRepo);
	const autoUpdateTrackersUseCase =
		params.autoUpdateTrackersUseCase ||
		new AutoUpdateTrackersUseCase(settingsRepo);
	const aiClient = params.aiClient || new FetchAiClient(new HttpClient());
	const verifyAiConnectionUseCase =
		params.verifyAiConnectionUseCase || new VerifyAiConnectionUseCase(aiClient);

	const getBangumiCalendarUseCase =
		params.getBangumiCalendarUseCase ||
		new GetBangumiCalendarUseCase(bangumiRepo);

	const getBangumiSubjectUseCase =
		params.getBangumiSubjectUseCase ||
		new GetBangumiSubjectUseCase(bangumiRepo);

	const getBangumiEpisodesUseCase =
		params.getBangumiEpisodesUseCase ||
		new GetBangumiEpisodesUseCase(bangumiRepo);

	const checkUpdateUseCase =
		params.checkUpdateUseCase || new CheckUpdateUseCase(updateRepo);
	const getCurrentVersionUseCase =
		params.getCurrentVersionUseCase || new GetCurrentVersionUseCase(updateRepo);
	const openUpdateUrlUseCase =
		params.openUpdateUrlUseCase || new OpenUpdateUrlUseCase(updateRepo);
	const openUrlUseCase =
		params.openUrlUseCase || new OpenUrlUseCase(openerRepo);

	return {
		notificationRepository: notificationRepo,
		logger: params.logger || dummyLogger,

		notifyDownloadCompletionUseCase: notifyUseCase,
		searchTorrentsUseCase,
		searchTorrentsWithAiUseCase,
		listTorrentsUseCase,
		subscribeTorrentsUseCase,
		pauseTorrentUseCase,
		resumeTorrentUseCase,
		deleteTorrentUseCase,
		addTorrentMagnetUseCase,
		getTorrentFilesUseCase,
		resolveTorrentUseCase,
		getTorrentStatusUseCase,
		getTorrentStreamUrlUseCase,
		getSubtitleTracksUseCase,
		getSubtitleVttUseCase,

		getSettingsUseCase,
		saveSettingsUseCase,
		selectDirectoryUseCase,
		syncTrackersUseCase,
		autoUpdateTrackersUseCase,
		verifyAiConnectionUseCase,
		aiClient,

		getBangumiCalendarUseCase,
		getBangumiSubjectUseCase,
		getBangumiEpisodesUseCase,
		checkUpdateUseCase,
		getCurrentVersionUseCase,
		openUpdateUrlUseCase,
		openUrlUseCase,
	};
}
