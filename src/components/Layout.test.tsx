import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { AppContextProvider } from "../context/AppContext";
import { DIProvider } from "../di/DIContext";
import { createDIContainerForTest } from "../test/test-utils";
import Layout from "./Layout";

describe("Layout 布局组件", () => {
	let mockRequestPermission: ReturnType<typeof vi.fn>;
	let mockExecute: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockRequestPermission = vi.fn().mockResolvedValue(true);
		mockExecute = vi.fn().mockResolvedValue(undefined);
	});

	const renderLayout = () => {
		const mockContainer = createDIContainerForTest({
			notificationRepository: {
				requestPermission: mockRequestPermission as () => Promise<boolean>,
				sendNotification: vi.fn(),
			},
			notifyDownloadCompletionUseCase: {
				execute: mockExecute as () => Promise<void>,
			} as any,
			subscribeTorrentsUseCase: {
				execute: vi.fn().mockImplementation((onUpdate) => {
					onUpdate([]);
					const interval = setInterval(() => {
						onUpdate([]);
					}, 3000);
					return Promise.resolve(() => clearInterval(interval));
				}),
			} as any,
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
		renderLayout();
		await waitFor(() => {
			expect(mockRequestPermission).toHaveBeenCalled();
		});
	});

	it("在挂载时应该立即执行一次下载监听", async () => {
		renderLayout();
		await waitFor(() => {
			expect(mockExecute).toHaveBeenCalledTimes(1);
		});
	});

	it("在定时轮询中应该重复执行下载监听", async () => {
		vi.useFakeTimers();
		renderLayout();

		// 等待首次挂载执行完成
		await act(async () => {
			await Promise.resolve();
		});
		expect(mockExecute).toHaveBeenCalledTimes(1);

		// 运行定时器 3000ms
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(mockExecute).toHaveBeenCalledTimes(2);

		// 运行定时器 3000ms
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(mockExecute).toHaveBeenCalledTimes(3);

		vi.useRealTimers();
	});

	it("当存在正在下载的任务时，下载管理标签应该显示正在下载的数量", async () => {
		const mockListTorrents = vi.fn().mockResolvedValue([
			{ info_hash: "1", name: "Torrent 1", finished: true, paused: false },
			{ info_hash: "2", name: "Torrent 2", finished: false, paused: true },
			{ info_hash: "3", name: "Torrent 3", finished: false, paused: false },
			{ info_hash: "4", name: "Torrent 4", finished: false, paused: false },
		]);

		const mockContainer = createDIContainerForTest({
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
				subscribeTorrents: vi.fn().mockImplementation((onUpdate) => {
					mockListTorrents()
						.then(onUpdate)
						.catch(() => {});
					const interval = setInterval(() => {
						mockListTorrents()
							.then(onUpdate)
							.catch(() => {});
					}, 3000);
					return Promise.resolve(() => clearInterval(interval));
				}),
			},
			notificationRepository: {
				requestPermission: mockRequestPermission as () => Promise<boolean>,
				sendNotification: vi.fn(),
			},
			notifyDownloadCompletionUseCase: {
				execute: mockExecute as () => Promise<void>,
			} as any,
		});

		const { findByText } = render(
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

		const badge = await findByText("2");
		expect(badge).toBeInTheDocument();
	});

	it("当获取正在下载的任务数量失败时，应该捕获错误且不崩溃", async () => {
		const mockListTorrents = vi
			.fn()
			.mockRejectedValue(new Error("Failed to fetch"));

		const mockContainer = createDIContainerForTest({
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
				subscribeTorrents: vi.fn().mockImplementation((onUpdate) => {
					mockListTorrents()
						.then(onUpdate)
						.catch(() => {});
					const interval = setInterval(() => {
						mockListTorrents()
							.then(onUpdate)
							.catch(() => {});
					}, 3000);
					return Promise.resolve(() => clearInterval(interval));
				}),
			},
			notificationRepository: {
				requestPermission: mockRequestPermission as () => Promise<boolean>,
				sendNotification: vi.fn(),
			},
			notifyDownloadCompletionUseCase: {
				execute: mockExecute as () => Promise<void>,
			} as any,
		});

		render(
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

		await waitFor(() => {
			expect(mockListTorrents).toHaveBeenCalled();
		});
	});
});
