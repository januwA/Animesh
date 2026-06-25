import { createContext, useContext } from "react";
import { GetBangumiCalendarUseCase } from "../application/bangumi/GetBangumiCalendarUseCase";
import { NotifyDownloadCompletionUseCase } from "../application/notification/NotifyDownloadCompletionUseCase";
import { GetSettingsUseCase } from "../application/settings/GetSettingsUseCase";
import { SaveSettingsUseCase } from "../application/settings/SaveSettingsUseCase";
import { SelectDirectoryUseCase } from "../application/settings/SelectDirectoryUseCase";
import { AddTorrentMagnetUseCase } from "../application/torrent/AddTorrentMagnetUseCase";
import { DeleteTorrentUseCase } from "../application/torrent/DeleteTorrentUseCase";
import { GetSubtitleTracksUseCase } from "../application/torrent/GetSubtitleTracksUseCase";
import { GetSubtitleVttUseCase } from "../application/torrent/GetSubtitleVttUseCase";
import { GetTorrentFilesUseCase } from "../application/torrent/GetTorrentFilesUseCase";
import { GetTorrentStatusUseCase } from "../application/torrent/GetTorrentStatusUseCase";
import { GetTorrentStreamUrlUseCase } from "../application/torrent/GetTorrentStreamUrlUseCase";
import { ListTorrentsUseCase } from "../application/torrent/ListTorrentsUseCase";
import { PauseTorrentUseCase } from "../application/torrent/PauseTorrentUseCase";
import { ResumeTorrentUseCase } from "../application/torrent/ResumeTorrentUseCase";
import { SearchTorrentsUseCase } from "../application/torrent/SearchTorrentsUseCase";
import type { BangumiRepository } from "../domain/bangumi/BangumiRepository";
import type { NotificationRepository } from "../domain/notification/NotificationRepository";
import type { SettingsRepository } from "../domain/settings/SettingsRepository";
import type { TorrentRepository } from "../domain/torrent/TorrentRepository";
import { HttpBangumiRepository } from "../infrastructure/bangumi/HttpBangumiRepository";
import { TauriNotificationRepository } from "../infrastructure/notification/TauriNotificationRepository";
import { TauriSettingsRepository } from "../infrastructure/settings/TauriSettingsRepository";
import { TauriTorrentRepository } from "../infrastructure/torrent/TauriTorrentRepository";

export interface DIContainer {
	torrentRepository: TorrentRepository;
	settingsRepository: SettingsRepository;
	bangumiRepository: BangumiRepository;
	notificationRepository: NotificationRepository;

	// UseCases
	notifyDownloadCompletionUseCase: NotifyDownloadCompletionUseCase;
	searchTorrentsUseCase: SearchTorrentsUseCase;
	listTorrentsUseCase: ListTorrentsUseCase;
	pauseTorrentUseCase: PauseTorrentUseCase;
	resumeTorrentUseCase: ResumeTorrentUseCase;
	deleteTorrentUseCase: DeleteTorrentUseCase;
	addTorrentMagnetUseCase: AddTorrentMagnetUseCase;
	getTorrentFilesUseCase: GetTorrentFilesUseCase;
	getTorrentStatusUseCase: GetTorrentStatusUseCase;
	getTorrentStreamUrlUseCase: GetTorrentStreamUrlUseCase;
	getSubtitleTracksUseCase: GetSubtitleTracksUseCase;
	getSubtitleVttUseCase: GetSubtitleVttUseCase;

	getSettingsUseCase: GetSettingsUseCase;
	saveSettingsUseCase: SaveSettingsUseCase;
	selectDirectoryUseCase: SelectDirectoryUseCase;

	getBangumiCalendarUseCase: GetBangumiCalendarUseCase;
}

export interface CreateContainerParams {
	torrentRepository: TorrentRepository;
	settingsRepository: SettingsRepository;
	bangumiRepository: BangumiRepository;
	notificationRepository?: NotificationRepository;

	// Optional UseCases for testing
	notifyDownloadCompletionUseCase?: NotifyDownloadCompletionUseCase;
	searchTorrentsUseCase?: SearchTorrentsUseCase;
	listTorrentsUseCase?: ListTorrentsUseCase;
	pauseTorrentUseCase?: PauseTorrentUseCase;
	resumeTorrentUseCase?: ResumeTorrentUseCase;
	deleteTorrentUseCase?: DeleteTorrentUseCase;
	addTorrentMagnetUseCase?: AddTorrentMagnetUseCase;
	getTorrentFilesUseCase?: GetTorrentFilesUseCase;
	getTorrentStatusUseCase?: GetTorrentStatusUseCase;
	getTorrentStreamUrlUseCase?: GetTorrentStreamUrlUseCase;
	getSubtitleTracksUseCase?: GetSubtitleTracksUseCase;
	getSubtitleVttUseCase?: GetSubtitleVttUseCase;

	getSettingsUseCase?: GetSettingsUseCase;
	saveSettingsUseCase?: SaveSettingsUseCase;
	selectDirectoryUseCase?: SelectDirectoryUseCase;

	getBangumiCalendarUseCase?: GetBangumiCalendarUseCase;
}

export function createDIContainer(params: CreateContainerParams): DIContainer {
	const torrentRepo = params.torrentRepository;
	const notificationRepo =
		params.notificationRepository || new TauriNotificationRepository();

	const notifyUseCase =
		params.notifyDownloadCompletionUseCase ||
		new NotifyDownloadCompletionUseCase(torrentRepo, notificationRepo);

	const searchTorrentsUseCase =
		params.searchTorrentsUseCase || new SearchTorrentsUseCase(torrentRepo);
	const listTorrentsUseCase =
		params.listTorrentsUseCase || new ListTorrentsUseCase(torrentRepo);
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
		params.getSettingsUseCase ||
		new GetSettingsUseCase(params.settingsRepository);
	const saveSettingsUseCase =
		params.saveSettingsUseCase ||
		new SaveSettingsUseCase(params.settingsRepository);
	const selectDirectoryUseCase =
		params.selectDirectoryUseCase ||
		new SelectDirectoryUseCase(params.settingsRepository);

	const getBangumiCalendarUseCase =
		params.getBangumiCalendarUseCase ||
		new GetBangumiCalendarUseCase(params.bangumiRepository);

	return {
		torrentRepository: torrentRepo,
		settingsRepository: params.settingsRepository,
		bangumiRepository: params.bangumiRepository,
		notificationRepository: notificationRepo,

		notifyDownloadCompletionUseCase: notifyUseCase,
		searchTorrentsUseCase,
		listTorrentsUseCase,
		pauseTorrentUseCase,
		resumeTorrentUseCase,
		deleteTorrentUseCase,
		addTorrentMagnetUseCase,
		getTorrentFilesUseCase,
		getTorrentStatusUseCase,
		getTorrentStreamUrlUseCase,
		getSubtitleTracksUseCase,
		getSubtitleVttUseCase,

		getSettingsUseCase,
		saveSettingsUseCase,
		selectDirectoryUseCase,

		getBangumiCalendarUseCase,
	};
}

let defaultContainerInstance: DIContainer | null = null;

export function createDefaultDIContainer(): DIContainer {
	if (!defaultContainerInstance) {
		const torrentRepository = new TauriTorrentRepository();
		const settingsRepository = new TauriSettingsRepository();
		const bangumiRepository = new HttpBangumiRepository();
		const notificationRepository = new TauriNotificationRepository();

		const notifyDownloadCompletionUseCase = new NotifyDownloadCompletionUseCase(
			torrentRepository,
			notificationRepository,
		);
		const searchTorrentsUseCase = new SearchTorrentsUseCase(torrentRepository);
		const listTorrentsUseCase = new ListTorrentsUseCase(torrentRepository);
		const pauseTorrentUseCase = new PauseTorrentUseCase(torrentRepository);
		const resumeTorrentUseCase = new ResumeTorrentUseCase(torrentRepository);
		const deleteTorrentUseCase = new DeleteTorrentUseCase(torrentRepository);
		const addTorrentMagnetUseCase = new AddTorrentMagnetUseCase(
			torrentRepository,
		);
		const getTorrentFilesUseCase = new GetTorrentFilesUseCase(
			torrentRepository,
		);
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
		const selectDirectoryUseCase = new SelectDirectoryUseCase(
			settingsRepository,
		);

		const getBangumiCalendarUseCase = new GetBangumiCalendarUseCase(
			bangumiRepository,
		);

		defaultContainerInstance = createDIContainer({
			torrentRepository,
			settingsRepository,
			bangumiRepository,
			notificationRepository,

			notifyDownloadCompletionUseCase,
			searchTorrentsUseCase,
			listTorrentsUseCase,
			pauseTorrentUseCase,
			resumeTorrentUseCase,
			deleteTorrentUseCase,
			addTorrentMagnetUseCase,
			getTorrentFilesUseCase,
			getTorrentStatusUseCase,
			getTorrentStreamUrlUseCase,
			getSubtitleTracksUseCase,
			getSubtitleVttUseCase,

			getSettingsUseCase,
			saveSettingsUseCase,
			selectDirectoryUseCase,

			getBangumiCalendarUseCase,
		});
	}
	return defaultContainerInstance;
}

const DIContext = createContext<DIContainer | null>(null);

export const DIProvider = DIContext.Provider;

export function useDI(): DIContainer {
	const container = useContext(DIContext);
	if (!container) {
		throw new Error(
			"DIContainer was not provided. Make sure to wrap components with <DIProvider>",
		);
	}
	return container;
}
