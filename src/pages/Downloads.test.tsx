import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import Layout from "../components/Layout";
import { AppContextProvider } from "../context/AppContext";
import type { DIContainer } from "../di/DIContext";
import { DIProvider } from "../di/DIContext";
import type { TorrentRepository } from "../domain/torrent/TorrentRepository";
import { createDIContainerForTest } from "../test/test-utils";
import Downloads from "./Downloads";

const currentLocation = {
	current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
	currentLocation.current = useLocation();
	return null;
};

describe("Downloads 页面组件", () => {
	let mockTorrentRepository: TorrentRepository;
	let mockContainer: DIContainer;

	beforeEach(() => {
		mockTorrentRepository = {
			search: vi.fn(),
			addTorrentMagnet: vi.fn(),
			getTorrentFiles: vi.fn(),
			listTorrents: vi.fn().mockResolvedValue([]),
			pauseTorrent: vi.fn(),
			resumeTorrent: vi.fn(),
			deleteTorrent: vi.fn(),
			getTorrentStreamUrl: vi.fn(),
			getTorrentStatus: vi.fn(),
			getSubtitleTracks: vi.fn(),
			getSubtitleVtt: vi.fn(),
			subscribeTorrents: vi.fn().mockImplementation((onUpdate) => {
				const runUpdate = async () => {
					const list = await mockTorrentRepository.listTorrents();
					onUpdate(list);
				};

				const promise = runUpdate();

				const interval = setInterval(async () => {
					try {
						const list = await mockTorrentRepository.listTorrents();
						onUpdate(list);
					} catch {}
				}, 1500);

				return promise.then(() => {
					return () => clearInterval(interval);
				});
			}),
		};

		mockContainer = createDIContainerForTest({
			torrentRepository: mockTorrentRepository,
			settingsRepository: {
				getSettings: vi.fn(),
				setDownloadDir: vi.fn(),
				setProxy: vi.fn(),
				setTrackers: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
			},
		});

		currentLocation.current = null;
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const renderDownloads = () => {
		return render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/downloads"]}>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route path="downloads" element={<Downloads />} />
							</Route>
							<Route path="/" element={<div>Home Page</div>} />
							<Route path="/torrent" element={<div>Torrent Page</div>} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);
	};

	it("应该在加载时渲染加载指示器", async () => {
		vi.mocked(mockTorrentRepository.listTorrents).mockImplementation(
			() => new Promise(() => {}),
		);

		renderDownloads();

		expect(screen.getByText("正在加载下载管理器...")).toBeInTheDocument();
	});

	it("当获取下载列表失败时，应该显示加载完成和Toast提示", async () => {
		vi.mocked(mockTorrentRepository.listTorrents).mockRejectedValue(
			"Fetch list failed",
		);

		renderDownloads();

		await waitFor(() => {
			expect(
				screen.queryByText("正在加载下载管理器..."),
			).not.toBeInTheDocument();
			expect(screen.getByText("获取下载列表失败")).toBeInTheDocument();
		});
	});

	it("当无下载任务时，应该渲染空状态并可以点击返回首页", async () => {
		vi.mocked(mockTorrentRepository.listTorrents).mockResolvedValue([]);

		renderDownloads();

		await waitFor(() => {
			expect(screen.getByText("没有正在进行的下载任务")).toBeInTheDocument();
		});

		const btn = screen.getByRole("button", { name: "前往搜索视频" });
		fireEvent.click(btn);

		expect(currentLocation.current?.pathname).toBe("/");
	});

	it("应该正确渲染下载任务列表，并轮询更新，且捕获轮询报错", async () => {
		vi.useFakeTimers();

		const mockTorrents = [
			{
				info_hash: "hash111",
				name: "动漫视频1",
				progress_bytes: 500,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 100,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
			},
		];

		vi.mocked(mockTorrentRepository.listTorrents).mockResolvedValue(
			mockTorrents,
		);

		renderDownloads();

		await act(async () => {
			await vi.runOnlyPendingTimersAsync();
		});

		expect(screen.getByText("动漫视频1")).toBeInTheDocument();

		const updatedTorrents = [
			{
				info_hash: "hash111",
				name: "动漫视频1",
				progress_bytes: 800,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 200,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
			},
		];
		vi.mocked(mockTorrentRepository.listTorrents).mockResolvedValue(
			updatedTorrents,
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		expect(screen.getByText(/进度: 80/)).toBeInTheDocument();

		vi.mocked(mockTorrentRepository.listTorrents).mockRejectedValueOnce(
			new Error("Network polling error"),
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		expect(screen.getByText("动漫视频1")).toBeInTheDocument();
	});

	it("应该支持暂停和恢复操作，包括成功和失败分支，并处理没有任务名的情况", async () => {
		const mockTorrents = [
			{
				info_hash: "hash111",
				name: "动漫视频1",
				progress_bytes: 100,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 50,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
			},
			{
				info_hash: "hash222",
				name: "",
				progress_bytes: 200,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 0,
				paused: true,
				peers_connected: 0,
				peers_total: 0,
			},
			{
				info_hash: "hash333",
				name: "",
				progress_bytes: 100,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 50,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
			},
			{
				info_hash: "hash444",
				name: "动漫视频4",
				progress_bytes: 200,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 0,
				paused: true,
				peers_connected: 0,
				peers_total: 0,
			},
		];

		vi.mocked(mockTorrentRepository.listTorrents).mockResolvedValue(
			mockTorrents,
		);

		renderDownloads();

		await waitFor(() => {
			expect(screen.getByText(/hash111/)).toBeInTheDocument();
		});

		vi.useFakeTimers();

		const pauseBtns = screen.getAllByTitle("暂停下载");
		const resumeBtns = screen.getAllByTitle("开始下载");

		// 1. Pause action (success, named)
		fireEvent.click(pauseBtns[0]);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(mockTorrentRepository.pauseTorrent).toHaveBeenCalledWith("hash111");
		expect(screen.getByText("已暂停任务: 动漫视频1")).toBeInTheDocument();

		// 2. Pause action (success, unnamed)
		fireEvent.click(pauseBtns[1]);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(mockTorrentRepository.pauseTorrent).toHaveBeenCalledWith("hash333");
		expect(screen.getByText("已暂停任务: hash333")).toBeInTheDocument();

		// 3. Pause action (failure)
		vi.mocked(mockTorrentRepository.pauseTorrent).mockRejectedValueOnce(
			"Pause error",
		);
		fireEvent.click(pauseBtns[0]);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getByText("暂停失败，请重试")).toBeInTheDocument();

		// 4. Resume action (success, unnamed)
		fireEvent.click(resumeBtns[0]);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(mockTorrentRepository.resumeTorrent).toHaveBeenCalledWith("hash222");
		expect(screen.getByText("已开始下载任务: hash222")).toBeInTheDocument();

		// 5. Resume action (success, named)
		fireEvent.click(resumeBtns[1]);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(mockTorrentRepository.resumeTorrent).toHaveBeenCalledWith("hash444");
		expect(screen.getByText("已开始下载任务: 动漫视频4")).toBeInTheDocument();

		// 6. Resume action (failure)
		vi.mocked(mockTorrentRepository.resumeTorrent).mockRejectedValueOnce(
			"Resume error",
		);
		fireEvent.click(resumeBtns[0]);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getByText("启动失败，请重试")).toBeInTheDocument();
	});

	it("应该支持查看文件操作，正确进行路由跳转 (有名字)", async () => {
		const mockTorrents = [
			{
				info_hash: "hash111",
				name: "动漫视频1",
				progress_bytes: 100,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 50,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
			},
		];

		vi.mocked(mockTorrentRepository.listTorrents).mockResolvedValue(
			mockTorrents,
		);

		renderDownloads();

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "查看文件" }),
			).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "查看文件" }));
		expect(currentLocation.current?.pathname).toBe("/torrent");
		expect(currentLocation.current?.search).toContain("infoHash=hash111");
		expect(currentLocation.current?.search).toContain(
			"title=%E5%8A%A8%E6%BC%AB%E8%A7%86%E9%A2%911",
		);
	});

	it("应该支持查看文件操作，正确进行路由跳转 (无名字)", async () => {
		const mockTorrents = [
			{
				info_hash: "hash222",
				name: "",
				progress_bytes: 100,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 50,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
			},
		];

		vi.mocked(mockTorrentRepository.listTorrents).mockResolvedValue(
			mockTorrents,
		);

		renderDownloads();

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "查看文件" }),
			).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "查看文件" }));
		expect(currentLocation.current?.pathname).toBe("/torrent");
		expect(currentLocation.current?.search).toContain("infoHash=hash222");
		expect(currentLocation.current?.search).toContain(
			"title=%E6%9C%AA%E5%91%BD%E5%90%8D%E7%A7%8D%E5%AD%90",
		);
	});

	it("应该支持删除操作，包含删除弹窗、文件删除勾选框、确定删除（成功/失败）及取消", async () => {
		const mockTorrents = [
			{
				info_hash: "hash111",
				name: null,
				progress_bytes: 500,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 0,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
			},
			{
				info_hash: "hash222",
				name: "动漫视频2",
				progress_bytes: 500,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 0,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
			},
		];

		vi.mocked(mockTorrentRepository.listTorrents).mockResolvedValue(
			mockTorrents,
		);

		renderDownloads();

		await waitFor(() => {
			expect(screen.getAllByTitle("删除下载").length).toBe(2);
		});

		const deleteBtns = screen.getAllByTitle("删除下载");

		vi.useFakeTimers();

		// 1. Open delete modal (for unnamed hash111), close with Escape key
		fireEvent.click(deleteBtns[0]);
		expect(screen.getByText("删除下载任务")).toBeInTheDocument();
		expect(screen.getByText("hash111")).toBeInTheDocument();

		fireEvent.keyDown(screen.getByRole("dialog"), {
			key: "Escape",
			code: "Escape",
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.queryByText("删除下载任务")).not.toBeInTheDocument();

		// 1b. Open delete modal again (unnamed) and click Cancel
		fireEvent.click(deleteBtns[0]);
		expect(screen.getByText("删除下载任务")).toBeInTheDocument();
		const cancelBtn = screen.getByRole("button", { name: "取消" });
		fireEvent.click(cancelBtn);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.queryByText("删除下载任务")).not.toBeInTheDocument();

		// 2. Open delete modal for Torrent 2 (named "动漫视频2"), toggle file checkbox, and proceed with success deletion
		fireEvent.click(deleteBtns[1]);
		expect(screen.getByText("删除下载任务")).toBeInTheDocument();
		expect(screen.getAllByText("动漫视频2").length).toBe(2);

		const checkbox = screen.getByLabelText(
			"同时删除已下载的本地缓存文件 (彻底释放磁盘空间)",
		);
		expect(checkbox).toBeInTheDocument();
		fireEvent.click(checkbox);

		const confirmBtn = screen.getByRole("button", { name: "确认删除" });
		fireEvent.click(confirmBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		expect(mockTorrentRepository.deleteTorrent).toHaveBeenCalledWith(
			"hash222",
			true,
		);
		expect(screen.getByText("已删除任务")).toBeInTheDocument();

		// 3. Delete modal failure (using unnamed)
		vi.mocked(mockTorrentRepository.deleteTorrent).mockRejectedValueOnce(
			"Delete failed",
		);

		fireEvent.click(deleteBtns[0]);
		fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		expect(screen.getByText("删除任务失败，请重试")).toBeInTheDocument();
	});

	it("应该能渲染已完成的下载任务", async () => {
		const mockTorrents = [
			{
				info_hash: "hashFinished",
				name: "已完成视频",
				progress_bytes: 1000,
				total_bytes: 1000,
				finished: true,
				download_speed_bytes_per_sec: 0,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
			},
			{
				info_hash: "hashZeroTotal",
				name: "零大小视频",
				progress_bytes: 0,
				total_bytes: 0,
				finished: true,
				download_speed_bytes_per_sec: 0,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
			},
		];

		vi.mocked(mockTorrentRepository.listTorrents).mockResolvedValue(
			mockTorrents,
		);

		renderDownloads();

		await waitFor(() => {
			expect(screen.getByText("已完成视频")).toBeInTheDocument();
			expect(screen.getByText("零大小视频")).toBeInTheDocument();
			expect(screen.getAllByText("已完成").length).toBe(2);
		});
	});

	it("应该在下载列表中展示创建时间，并按创建时间倒序排列(最新的在最前面)", async () => {
		const mockTorrents = [
			{
				info_hash: "hashOld",
				name: "较旧的任务",
				progress_bytes: 100,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 10,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
				created_at: 1719816000000, // 2026-07-01 12:00:00 UTC (roughly)
			},
			{
				info_hash: "hashNew",
				name: "较新的任务",
				progress_bytes: 200,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 20,
				paused: false,
				peers_connected: 0,
				peers_total: 0,
				created_at: 1719819600000, // 2026-07-01 13:00:00 UTC (roughly)
			},
		];

		vi.mocked(mockTorrentRepository.listTorrents).mockResolvedValue(
			mockTorrents,
		);

		renderDownloads();

		await waitFor(() => {
			expect(screen.getByText("较新的任务")).toBeInTheDocument();
			expect(screen.getByText("较旧的任务")).toBeInTheDocument();
		});

		// 检查两个任务在 DOM 中的顺序，较新的任务应该在较旧的任务前面
		const cards = screen.getAllByTitle(/较/);
		const titles = cards.map((c) => c.textContent);
		expect(titles[0]).toBe("较新的任务");
		expect(titles[1]).toBe("较旧的任务");

		// 检查创建时间是否渲染
		expect(screen.getAllByText(/创建时间:/).length).toBe(2);
	});
});
