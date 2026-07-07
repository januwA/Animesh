import { createContext, use } from "react";
import { GetBangumiCalendarUseCase } from "../application/bangumi/GetBangumiCalendarUseCase";
import { GetBangumiEpisodesUseCase } from "../application/bangumi/GetBangumiEpisodesUseCase";
import { GetBangumiSubjectUseCase } from "../application/bangumi/GetBangumiSubjectUseCase";
import { NotifyDownloadCompletionUseCase } from "../application/notification/NotifyDownloadCompletionUseCase";
import { AutoUpdateTrackersUseCase } from "../application/settings/AutoUpdateTrackersUseCase";
import { GetSettingsUseCase } from "../application/settings/GetSettingsUseCase";
import { SaveSettingsUseCase } from "../application/settings/SaveSettingsUseCase";
import { SelectDirectoryUseCase } from "../application/settings/SelectDirectoryUseCase";
import { SyncTrackersUseCase } from "../application/settings/SyncTrackersUseCase";
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
import { SubscribeTorrentsUseCase } from "../application/torrent/SubscribeTorrentsUseCase";
import { CheckUpdateUseCase } from "../application/update/CheckUpdateUseCase";
import { GetCurrentVersionUseCase } from "../application/update/GetCurrentVersionUseCase";
import { OpenUpdateUrlUseCase } from "../application/update/OpenUpdateUrlUseCase";
import type { Logger } from "../domain/logger/logger";
import type { NotificationRepository } from "../domain/notification/NotificationRepository";
import { HttpBangumiRepository } from "../infrastructure/bangumi/HttpBangumiRepository";
import { HttpClient } from "../infrastructure/http/HttpClient";
import { ConsoleLogger } from "../infrastructure/logger/ConsoleLogger";
import { TauriNotificationRepository } from "../infrastructure/notification/TauriNotificationRepository";
import { TauriSettingsRepository } from "../infrastructure/settings/TauriSettingsRepository";
import { TauriTorrentRepository } from "../infrastructure/torrent/TauriTorrentRepository";
import { GithubUpdateRepository } from "../infrastructure/update/GithubUpdateRepository";

export interface DIContainer {
	notificationRepository: NotificationRepository;
	logger: Logger;

	// UseCases
	notifyDownloadCompletionUseCase: NotifyDownloadCompletionUseCase;
	searchTorrentsUseCase: SearchTorrentsUseCase;
	listTorrentsUseCase: ListTorrentsUseCase;
	subscribeTorrentsUseCase: SubscribeTorrentsUseCase;
	pauseTorrentUseCase: PauseTorrentUseCase;
	resumeTorrentUseCase: ResumeTorrentUseCase;
	deleteTorrentUseCase: DeleteTorrentUseCase;
	addTorrentMagnetUseCase: AddTorrentMagnetUseCase;
	getTorrentFilesUseCase: GetTorrentFilesUseCase;
	resolveTorrentUseCase: ResolveTorrentUseCase;
	getTorrentStatusUseCase: GetTorrentStatusUseCase;
	getTorrentStreamUrlUseCase: GetTorrentStreamUrlUseCase;
	getSubtitleTracksUseCase: GetSubtitleTracksUseCase;
	getSubtitleVttUseCase: GetSubtitleVttUseCase;

	getSettingsUseCase: GetSettingsUseCase;
	saveSettingsUseCase: SaveSettingsUseCase;
	selectDirectoryUseCase: SelectDirectoryUseCase;
	syncTrackersUseCase: SyncTrackersUseCase;
	autoUpdateTrackersUseCase: AutoUpdateTrackersUseCase;

	getBangumiCalendarUseCase: GetBangumiCalendarUseCase;
	getBangumiSubjectUseCase: GetBangumiSubjectUseCase;
	getBangumiEpisodesUseCase: GetBangumiEpisodesUseCase;
	checkUpdateUseCase: CheckUpdateUseCase;
	getCurrentVersionUseCase: GetCurrentVersionUseCase;
	openUpdateUrlUseCase: OpenUpdateUrlUseCase;
}

export function createDefaultDIContainer(): DIContainer {
	const torrentRepository = new TauriTorrentRepository();
	const settingsRepository = new TauriSettingsRepository();
	const httpClient = new HttpClient();
	const bangumiRepository = new HttpBangumiRepository(httpClient);
	const notificationRepository = new TauriNotificationRepository();
	const updateRepository = new GithubUpdateRepository();

	const notifyDownloadCompletionUseCase = new NotifyDownloadCompletionUseCase(
		torrentRepository,
		notificationRepository,
	);
	const searchTorrentsUseCase = new SearchTorrentsUseCase(torrentRepository);
	const listTorrentsUseCase = new ListTorrentsUseCase(torrentRepository);
	const subscribeTorrentsUseCase = new SubscribeTorrentsUseCase(
		torrentRepository,
	);
	const pauseTorrentUseCase = new PauseTorrentUseCase(torrentRepository);
	const resumeTorrentUseCase = new ResumeTorrentUseCase(torrentRepository);
	const deleteTorrentUseCase = new DeleteTorrentUseCase(torrentRepository);
	const addTorrentMagnetUseCase = new AddTorrentMagnetUseCase(
		torrentRepository,
	);
	const getTorrentFilesUseCase = new GetTorrentFilesUseCase(torrentRepository);
	const resolveTorrentUseCase = new ResolveTorrentUseCase(torrentRepository);
	const getTorrentStatusUseCase = new GetTorrentStatusUseCase(
		torrentRepository,
	);
	const getTorrentStreamUrlUseCase = new GetTorrentStreamUrlUseCase(
		torrentRepository,
	);
	const getSubtitleTracksUseCase = new GetSubtitleTracksUseCase(
		torrentRepository,
	);
	const getSubtitleVttUseCase = new GetSubtitleVttUseCase(torrentRepository);

	const getSettingsUseCase = new GetSettingsUseCase(settingsRepository);
	const saveSettingsUseCase = new SaveSettingsUseCase(settingsRepository);
	const selectDirectoryUseCase = new SelectDirectoryUseCase(settingsRepository);
	const syncTrackersUseCase = new SyncTrackersUseCase(settingsRepository);
	const autoUpdateTrackersUseCase = new AutoUpdateTrackersUseCase(
		settingsRepository,
	);

	const getBangumiCalendarUseCase = new GetBangumiCalendarUseCase(
		bangumiRepository,
	);
	const getBangumiSubjectUseCase = new GetBangumiSubjectUseCase(
		bangumiRepository,
	);
	const getBangumiEpisodesUseCase = new GetBangumiEpisodesUseCase(
		bangumiRepository,
	);
	const checkUpdateUseCase = new CheckUpdateUseCase(updateRepository);
	const getCurrentVersionUseCase = new GetCurrentVersionUseCase(
		updateRepository,
	);
	const openUpdateUrlUseCase = new OpenUpdateUrlUseCase(updateRepository);

	const logger = new ConsoleLogger("App");

	return {
		notificationRepository,
		logger,

		notifyDownloadCompletionUseCase,
		searchTorrentsUseCase,
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

		getBangumiCalendarUseCase,
		getBangumiSubjectUseCase,
		getBangumiEpisodesUseCase,
		checkUpdateUseCase,
		getCurrentVersionUseCase,
		openUpdateUrlUseCase,
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
