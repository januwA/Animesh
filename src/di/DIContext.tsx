import { createContext, use } from "react";
import {
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
import { NotifyDownloadCompletionUseCase } from "../application/notification/NotifyDownloadCompletionUseCase";
import { OpenUrlUseCase } from "../application/opener/OpenUrlUseCase";
import { AutoUpdateTrackersUseCase } from "../application/settings/AutoUpdateTrackersUseCase";
import { GetDefaultTrackersUseCase } from "../application/settings/GetDefaultTrackersUseCase";
import { GetSettingsUseCase } from "../application/settings/GetSettingsUseCase";
import { SaveSettingsUseCase } from "../application/settings/SaveSettingsUseCase";
import { SelectDirectoryUseCase } from "../application/settings/SelectDirectoryUseCase";
import { SetThemeUseCase } from "../application/settings/SetThemeUseCase";
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
import type { AiClient } from "../domain/ai/AiClient";
import type { Logger } from "../domain/logger/logger";
import type { NotificationRepository } from "../domain/notification/NotificationRepository";
import { BrowserBangumiCache } from "../infrastructure/bangumi/BrowserBangumiCache";
import { HttpBangumiRepository } from "../infrastructure/bangumi/HttpBangumiRepository";
import { HttpClient } from "../infrastructure/http/HttpClient";
import { ConsoleLogger } from "../infrastructure/logger/ConsoleLogger";

export interface DIContainer {
	notificationRepository: NotificationRepository;
	logger: Logger;

	// UseCases
	notifyDownloadCompletionUseCase: NotifyDownloadCompletionUseCase;
	searchTorrentsUseCase: SearchTorrentsUseCase;
	searchTorrentsWithAiUseCase: SearchTorrentsWithAiUseCase;
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
	getDefaultTrackersUseCase: GetDefaultTrackersUseCase;
	saveSettingsUseCase: SaveSettingsUseCase;
	selectDirectoryUseCase: SelectDirectoryUseCase;
	syncTrackersUseCase: SyncTrackersUseCase;
	autoUpdateTrackersUseCase: AutoUpdateTrackersUseCase;
	verifyAiConnectionUseCase: VerifyAiConnectionUseCase;
	setThemeUseCase: SetThemeUseCase;
	aiClient: AiClient;

	getBangumiCalendarUseCase: GetBangumiCalendarUseCase;
	getBangumiSubjectUseCase: GetBangumiSubjectUseCase;
	getBangumiEpisodesUseCase: GetBangumiEpisodesUseCase;
	getBangumiPersonsUseCase: GetBangumiPersonsUseCase;
	getBangumiCharactersUseCase: GetBangumiCharactersUseCase;
	checkUpdateUseCase: CheckUpdateUseCase;
	getCurrentVersionUseCase: GetCurrentVersionUseCase;
	openUpdateUrlUseCase: OpenUpdateUrlUseCase;
	openUrlUseCase: OpenUrlUseCase;
}

export function createDefaultDIContainer(): DIContainer {
	const isTauri = import.meta.env.MODE !== "web";
	const logger = new ConsoleLogger("App");
	const torrentRepository = new TorrentRepositoryImpl();
	const settingsRepository = new SettingsRepositoryImpl();
	const httpClient = new HttpClient();
	const bangumiRepository = new HttpBangumiRepository(httpClient);
	const notificationRepository = new NotificationRepositoryImpl();
	const openerRepository = new OpenerRepositoryImpl();
	const updateRepository = new UpdateRepositoryImpl(openerRepository);

	const notifyDownloadCompletionUseCase = new NotifyDownloadCompletionUseCase(
		torrentRepository,
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
	const getDefaultTrackersUseCase = new GetDefaultTrackersUseCase(
		settingsRepository,
	);
	const saveSettingsUseCase = new SaveSettingsUseCase(settingsRepository);
	const selectDirectoryUseCase = new SelectDirectoryUseCase(settingsRepository);
	const syncTrackersUseCase = new SyncTrackersUseCase(settingsRepository);
	const autoUpdateTrackersUseCase = new AutoUpdateTrackersUseCase(
		settingsRepository,
	);
	const verifyAiConnectionUseCase = new VerifyAiConnectionUseCase(aiClient);
	const setThemeUseCase = new SetThemeUseCase(settingsRepository);

	const bangumiCache = new BrowserBangumiCache();
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
	const checkUpdateUseCase = new CheckUpdateUseCase(updateRepository);
	const getCurrentVersionUseCase = new GetCurrentVersionUseCase(
		updateRepository,
	);
	const openUpdateUrlUseCase = new OpenUpdateUrlUseCase(updateRepository);
	const openUrlUseCase = new OpenUrlUseCase(openerRepository);

	return {
		notificationRepository,
		logger,

		notifyDownloadCompletionUseCase,
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
		getDefaultTrackersUseCase,
		saveSettingsUseCase,
		selectDirectoryUseCase,
		syncTrackersUseCase,
		autoUpdateTrackersUseCase,
		verifyAiConnectionUseCase,
		setThemeUseCase,
		aiClient,

		getBangumiCalendarUseCase,
		getBangumiSubjectUseCase,
		getBangumiEpisodesUseCase,
		getBangumiPersonsUseCase,
		getBangumiCharactersUseCase,
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
