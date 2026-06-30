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
import { SubscribeTorrentsUseCase } from "../application/torrent/SubscribeTorrentsUseCase";
import type { DIContainer } from "../di/DIContext";
import type { BangumiRepository } from "../domain/bangumi/BangumiRepository";
import type { NotificationRepository } from "../domain/notification/NotificationRepository";
import type { SettingsRepository } from "../domain/settings/SettingsRepository";
import type { TorrentRepository } from "../domain/torrent/TorrentRepository";

export interface CreateContainerParamsForTest {
	torrentRepository?: TorrentRepository;
	settingsRepository?: SettingsRepository;
	bangumiRepository?: BangumiRepository;
	notificationRepository?: NotificationRepository;

	notifyDownloadCompletionUseCase?: NotifyDownloadCompletionUseCase;
	searchTorrentsUseCase?: SearchTorrentsUseCase;
	listTorrentsUseCase?: ListTorrentsUseCase;
	subscribeTorrentsUseCase?: SubscribeTorrentsUseCase;
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

export function createDIContainerForTest(
	params: CreateContainerParamsForTest,
): DIContainer {
	const torrentRepo = params.torrentRepository
		? ({
				...params.torrentRepository,
				subscribeTorrents:
					params.torrentRepository.subscribeTorrents ||
					(async (onUpdate: (list: any[]) => void) => {
						onUpdate([]);
						return () => {};
					}),
			} as unknown as TorrentRepository)
		: ({
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
			} as unknown as TorrentRepository);

	const settingsRepo =
		params.settingsRepository ||
		({
			getSettings: async () => ({ download_dir: "", trackers: [] }),
			setDownloadDir: async () => {},
			setProxy: async () => {},
			setTrackers: async () => {},
			selectDirectory: async () => null,
		} as SettingsRepository);

	const bangumiRepo =
		params.bangumiRepository ||
		({
			getCalendar: async () => [],
		} as BangumiRepository);

	const notificationRepo =
		params.notificationRepository ||
		({
			requestPermission: async () => false,
			sendNotification: async () => {},
		} as NotificationRepository);

	const notifyUseCase =
		params.notifyDownloadCompletionUseCase ||
		new NotifyDownloadCompletionUseCase(torrentRepo, notificationRepo);

	const searchTorrentsUseCase =
		params.searchTorrentsUseCase || new SearchTorrentsUseCase(torrentRepo);
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

	const getBangumiCalendarUseCase =
		params.getBangumiCalendarUseCase ||
		new GetBangumiCalendarUseCase(bangumiRepo);

	return {
		torrentRepository: torrentRepo,
		settingsRepository: settingsRepo,
		bangumiRepository: bangumiRepo,
		notificationRepository: notificationRepo,

		notifyDownloadCompletionUseCase: notifyUseCase,
		searchTorrentsUseCase,
		listTorrentsUseCase,
		subscribeTorrentsUseCase,
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
