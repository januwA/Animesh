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
		// biome-ignore lint/suspicious/noExplicitAny: mock tauri internals
		(window as any).__TAURI_INTERNALS__ = {};
	});

	afterEach(() => {
		// biome-ignore lint/suspicious/noExplicitAny: mock tauri internals
		delete (window as any).__TAURI_INTERNALS__;
	});

	const renderLayout = () => {
		const mockContainer = createDIContainerForTest({
			torrentRepository: {
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
			},
			settingsRepository: {
				getSettings: vi
					.fn()
					.mockResolvedValue({ download_dir: "", proxy: null }),
				setDownloadDir: vi.fn(),
				setProxy: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn(),
			},
			notificationRepository: {
				requestPermission: mockRequestPermission as () => Promise<boolean>,
				sendNotification: vi.fn(),
			},
			notifyDownloadCompletionUseCase: {
				execute: mockExecute as () => Promise<void>,
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
});
