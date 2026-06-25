import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { AppContextProvider } from "../context/AppContext";
import { createDIContainer, DIProvider } from "../di/DIContext";
import type { TorrentStatusInfo } from "../types";
import Layout from "./Layout";

describe("Layout 布局组件", () => {
	let mockRequestPermission: ReturnType<typeof vi.fn>;
	let mockSendNotification: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockRequestPermission = vi.fn().mockResolvedValue(true);
		mockSendNotification = vi.fn().mockResolvedValue(undefined);
		// biome-ignore lint/suspicious/noExplicitAny: mock tauri internals
		(window as any).__TAURI_INTERNALS__ = {};
	});

	afterEach(() => {
		// biome-ignore lint/suspicious/noExplicitAny: mock tauri internals
		delete (window as any).__TAURI_INTERNALS__;
	});

	const renderLayout = (
		mockListTorrents: () => Promise<TorrentStatusInfo[]>,
	) => {
		const mockContainer = createDIContainer({
			torrentRepository: {
				search: vi.fn(),
				addTorrentMagnet: vi.fn(),
				getTorrentFiles: vi.fn(),
				listTorrents: mockListTorrents,
				pauseTorrent: vi.fn(),
				resumeTorrent: vi.fn(),
				deleteTorrent: vi.fn(),
				getTorrentStreamUrl: vi.fn(),
				getTorrentStatus: vi.fn(),
				getSubtitleTracks: vi.fn(),
				getSubtitleVtt: vi.fn(),
			},
			settingsRepository: {
				getSettings: vi
					.fn()
					.mockResolvedValue({ download_dir: "", proxy: null }),
				setDownloadDir: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn(),
			},
			notificationRepository: {
				requestPermission: mockRequestPermission as () => Promise<boolean>,
				sendNotification: mockSendNotification as (
					title: string,
					body: string,
				) => Promise<void>,
			},
		});

		return render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/"]}>
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route path="" element={<div>首页内容</div>} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);
	};

	it("在挂载时应该请求系统通知权限", async () => {
		renderLayout(() => Promise.resolve([]));
		await waitFor(() => {
			expect(mockRequestPermission).toHaveBeenCalled();
		});
	});

	it("首次加载时，不应对现有的已完成下载触发通知", async () => {
		vi.useFakeTimers();
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

		renderLayout(() => Promise.resolve(torrents));

		// 等待第一个轮询运行完成 (微任务队列清空，不推进时间)
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(mockSendNotification).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it("在后续轮询中，有新的完成下载应该触发系统通知", async () => {
		vi.useFakeTimers();
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

		const mockListTorrents = async () => {
			callCount++;
			if (callCount === 1) {
				return [torrent1];
			}
			// 第二次调用时变成 finished
			return [{ ...torrent1, finished: true, progress_bytes: 100 }];
		};

		renderLayout(mockListTorrents);

		// 运行首次加载 (仅等待 Promise 解决，不推进计时器)
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(mockSendNotification).not.toHaveBeenCalled();

		// 运行第二次轮询 (3000ms 后触发)
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(mockSendNotification).toHaveBeenCalledWith(
			"下载完成",
			"动漫 《动漫1》 已下载完成！",
		);

		vi.useRealTimers();
	});

	it("如果种子从完成变回未完成(重启下载)，应该重置已通知记录", async () => {
		vi.useFakeTimers();
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

		const mockListTorrents = async () => {
			callCount++;
			if (callCount === 1) {
				// 首次加载为已完成
				return [torrent1];
			}
			if (callCount === 2) {
				// 第二次为未完成
				return [{ ...torrent1, finished: false, progress_bytes: 50 }];
			}
			// 第三次又变成完成
			return [{ ...torrent1, finished: true, progress_bytes: 100 }];
		};

		renderLayout(mockListTorrents);

		// 运行首次加载
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(mockSendNotification).not.toHaveBeenCalled();

		// 运行第二次轮询 (变回下载中)
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(mockSendNotification).not.toHaveBeenCalled();

		// 运行第三次轮询 (重新变回完成)
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(mockSendNotification).toHaveBeenCalledWith(
			"下载完成",
			"动漫 《动漫1》 已下载完成！",
		);

		vi.useRealTimers();
	});

	it("如果获取种子列表失败，应该捕获错误不崩溃", async () => {
		vi.useFakeTimers();
		renderLayout(() => Promise.reject("Fetch error"));
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		vi.useRealTimers();
	});
});
