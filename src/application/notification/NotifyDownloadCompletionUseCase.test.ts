import { vi } from "vitest";
import type { NotificationRepository } from "../../domain/notification/NotificationRepository";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import type { TorrentStatusInfo } from "../../types";
import { NotifyDownloadCompletionUseCase } from "./NotifyDownloadCompletionUseCase";

describe("NotifyDownloadCompletionUseCase 下载完成通知业务编排", () => {
	let mockTorrentRepository: TorrentRepository;
	let mockNotificationRepository: NotificationRepository;
	let useCase: NotifyDownloadCompletionUseCase;

	beforeEach(() => {
		vi.clearAllMocks();

		mockTorrentRepository = {
			search: vi.fn(),
			addTorrentMagnet: vi.fn(),
			getTorrentFiles: vi.fn(),
			listTorrents: vi.fn(),
			pauseTorrent: vi.fn(),
			resumeTorrent: vi.fn(),
			deleteTorrent: vi.fn(),
			getTorrentStreamUrl: vi.fn(),
			getTorrentStatus: vi.fn(),
			getSubtitleTracks: vi.fn(),
			getSubtitleVtt: vi.fn(),
		};

		mockNotificationRepository = {
			requestPermission: vi.fn().mockResolvedValue(true),
			sendNotification: vi.fn().mockResolvedValue(undefined),
		};

		useCase = new NotifyDownloadCompletionUseCase(
			mockTorrentRepository,
			mockNotificationRepository,
		);
	});

	it("首次加载时，不应对现有的已完成下载触发通知", async () => {
		const torrents: TorrentStatusInfo[] = [
			{
				info_hash: "hash1",
				name: "动漫1",
				progress_bytes: 100,
				total_bytes: 100,
				finished: true,
				download_speed_bytes_per_sec: 0,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
			},
		];

		vi.mocked(mockTorrentRepository.listTorrents).mockResolvedValue(torrents);

		await useCase.execute();

		expect(mockNotificationRepository.sendNotification).not.toHaveBeenCalled();
	});

	it("在后续运行中，有新的完成下载应该触发系统通知", async () => {
		let callCount = 0;
		const torrent1: TorrentStatusInfo = {
			info_hash: "hash1",
			name: "动漫1",
			progress_bytes: 50,
			total_bytes: 100,
			finished: false,
			download_speed_bytes_per_sec: 10,
			paused: false,
			peers_connected: 1,
			peers_total: 1,
		};

		vi.mocked(mockTorrentRepository.listTorrents).mockImplementation(
			async () => {
				callCount++;
				if (callCount === 1) {
					return [torrent1];
				}
				return [{ ...torrent1, finished: true, progress_bytes: 100 }];
			},
		);

		// 运行首次加载
		await useCase.execute();
		expect(mockNotificationRepository.sendNotification).not.toHaveBeenCalled();

		// 运行第二次加载
		await useCase.execute();
		expect(mockNotificationRepository.sendNotification).toHaveBeenCalledWith(
			"下载完成",
			"动漫 《动漫1》 已下载完成！",
		);
	});

	it("如果种子从完成变回未完成(重启下载)，应该重置已通知记录", async () => {
		let callCount = 0;
		const torrent1: TorrentStatusInfo = {
			info_hash: "hash1",
			name: "动漫1",
			progress_bytes: 100,
			total_bytes: 100,
			finished: true,
			download_speed_bytes_per_sec: 0,
			paused: false,
			peers_connected: 0,
			peers_total: 0,
		};

		vi.mocked(mockTorrentRepository.listTorrents).mockImplementation(
			async () => {
				callCount++;
				if (callCount === 1) {
					return [torrent1];
				}
				if (callCount === 2) {
					return [{ ...torrent1, finished: false, progress_bytes: 50 }];
				}
				return [{ ...torrent1, finished: true, progress_bytes: 100 }];
			},
		);

		// 运行首次加载
		await useCase.execute();
		expect(mockNotificationRepository.sendNotification).not.toHaveBeenCalled();

		// 运行第二次加载 (变回下载中)
		await useCase.execute();
		expect(mockNotificationRepository.sendNotification).not.toHaveBeenCalled();

		// 运行第三次加载 (重新变回完成)
		await useCase.execute();
		expect(mockNotificationRepository.sendNotification).toHaveBeenCalledWith(
			"下载完成",
			"动漫 《动漫1》 已下载完成！",
		);
	});

	it("如果获取种子列表失败，应该捕获错误不崩溃并打印错误", async () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(mockTorrentRepository.listTorrents).mockRejectedValue(
			new Error("Fetch error"),
		);

		await useCase.execute();

		expect(consoleSpy).toHaveBeenCalledWith(
			"Error in background torrent check UseCase:",
			expect.any(Error),
		);
		consoleSpy.mockRestore();
	});
});
