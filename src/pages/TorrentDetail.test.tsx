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
import type { AddTorrentResult } from "../types";
import TorrentDetail from "./TorrentDetail";

const currentLocation = {
	current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
	currentLocation.current = useLocation();
	return null;
};
const getCurrentLocation = () => currentLocation.current;

describe("TorrentDetail 页面组件", () => {
	let mockTorrentRepository: TorrentRepository;
	let mockContainer: DIContainer;

	beforeEach(() => {
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

	const renderTorrentDetail = (initialEntry: string) => {
		return render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={[initialEntry]}>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route index element={<div>Home Page</div>} />
								<Route path="torrent" element={<TorrentDetail />} />
								<Route path="downloads" element={<div>Downloads Page</div>} />
								<Route
									path="play/:infoHash/:fileId"
									element={<div>Play Page</div>}
								/>
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);
	};

	it("当没有提供有效的磁力链接或 Hash 时，应该显示错误提示", async () => {
		renderTorrentDetail("/torrent");

		await waitFor(() => {
			expect(
				screen.getByText("未提供有效的磁力链接或种子 Hash"),
			).toBeInTheDocument();
		});
	});

	it("应该成功通过磁力链接解析种子元数据并渲染文件列表，同时支持点击播放进行跳转", async () => {
		const mockResult = {
			info_hash: "hash123",
			name: "测试种子",
			files: [
				{ id: 0, name: "file1.mp4", len: 1000 },
				{ id: 1, name: "file2.mkv", len: 2000 },
			],
		};

		vi.mocked(mockTorrentRepository.addTorrentMagnet).mockResolvedValue(
			mockResult,
		);

		renderTorrentDetail("/torrent?magnet=magnet_link&title=mock_title");

		expect(
			screen.getByText("正在启动下载引擎并解析种子..."),
		).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText("测试种子")).toBeInTheDocument();
			expect(screen.getByText("共 2 个文件")).toBeInTheDocument();
			expect(screen.getByText("file1.mp4")).toBeInTheDocument();
			expect(screen.getByText("file2.mkv")).toBeInTheDocument();
		});

		const playButtons = screen.getAllByRole("button", { name: "▶ 播放" });
		fireEvent.click(playButtons[0]);

		expect(getCurrentLocation()?.pathname).toBe("/play/hash123/0");
		expect(getCurrentLocation()?.search).toContain("magnet=magnet_link");
		expect(getCurrentLocation()?.search).toContain("title=mock_title");
		expect(getCurrentLocation()?.search).toContain("fileName=file1.mp4");
	});

	it("当解析磁力链接失败时，应该显示相应的解析失败界面（支持 string 错误和非 string 错误）", async () => {
		// 1. String error
		vi.mocked(mockTorrentRepository.addTorrentMagnet).mockRejectedValueOnce(
			"Resolve timeout",
		);

		const { unmount } = renderTorrentDetail("/torrent?magnet=maglink");

		await waitFor(() => {
			expect(screen.getByText("Resolve timeout")).toBeInTheDocument();
		});

		unmount();

		// 2. Non-string error (Error object)
		vi.mocked(mockTorrentRepository.addTorrentMagnet).mockRejectedValueOnce(
			new Error("Fatal error"),
		);

		renderTorrentDetail("/torrent?magnet=maglink");

		await waitFor(() => {
			expect(screen.getByText("错误详情请见控制台")).toBeInTheDocument();
		});
	});

	it("应该支持使用 infoHash 获取现有种子的缓存文件列表并渲染", async () => {
		const mockFiles = [{ id: 0, name: "video.mp4", len: 5000 }];

		vi.mocked(mockTorrentRepository.getTorrentFiles).mockResolvedValue(
			mockFiles,
		);

		renderTorrentDetail("/torrent?infoHash=hash789");

		await waitFor(() => {
			expect(screen.getByText("已缓存种子")).toBeInTheDocument();
			expect(screen.getByText("video.mp4")).toBeInTheDocument();
		});
	});

	it("当使用 infoHash 获取文件列表失败时，应该显示相应的失败错误提示", async () => {
		vi.mocked(mockTorrentRepository.getTorrentFiles).mockRejectedValueOnce(
			"Get files error",
		);

		renderTorrentDetail("/torrent?infoHash=hash789");

		await waitFor(() => {
			expect(screen.getByText("Get files error")).toBeInTheDocument();
		});
	});

	it("应该支持取消或返回操作，并根据是否只有 infoHash 导航到相应的前序页面（包含 Loading、Error 和 Success 状态下的按钮）", async () => {
		// 1. Loading with infoHash only (should go to downloads)
		vi.mocked(mockTorrentRepository.getTorrentFiles).mockImplementation(
			() => new Promise(() => {}),
		);
		const render1 = renderTorrentDetail("/torrent?infoHash=hash123");

		const cancelBtn1 = screen.getByRole("button", {
			name: "取消并返回下载管理",
		});
		fireEvent.click(cancelBtn1);
		expect(getCurrentLocation()?.pathname).toBe("/downloads");

		render1.unmount();
		currentLocation.current = null;

		// 2. Loading with magnet present (should go to /)
		vi.mocked(mockTorrentRepository.addTorrentMagnet).mockImplementation(
			() => new Promise(() => {}),
		);
		const render2 = renderTorrentDetail("/torrent?magnet=maglink");

		const cancelBtn2 = screen.getByRole("button", { name: "取消解析并返回" });
		fireEvent.click(cancelBtn2);
		expect(getCurrentLocation()?.pathname).toBe("/");

		render2.unmount();
		currentLocation.current = null;

		// 3. Error state with infoHash (should go to downloads)
		vi.mocked(mockTorrentRepository.getTorrentFiles).mockRejectedValueOnce(
			"Fetch error",
		);
		const render3 = renderTorrentDetail("/torrent?infoHash=hash123");

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "返回下载管理" }),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole("button", { name: "返回下载管理" }));
		expect(getCurrentLocation()?.pathname).toBe("/downloads");

		render3.unmount();
		currentLocation.current = null;

		// 4. Success state with magnet (should go to /)
		vi.mocked(mockTorrentRepository.addTorrentMagnet).mockResolvedValue({
			info_hash: "hash123",
			name: "测试种子",
			files: [{ id: 0, name: "file1.mp4", len: 1000 }],
		});

		renderTorrentDetail("/torrent?magnet=maglink");

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "返回搜索" }),
			).toBeInTheDocument();
		});

		const closeBtn = screen.getByText("✕");
		fireEvent.click(closeBtn);
		expect(getCurrentLocation()?.pathname).toBe("/");
	});

	it("应该支持按下 Escape 键退出并导航返回", async () => {
		vi.mocked(mockTorrentRepository.addTorrentMagnet).mockResolvedValue({
			info_hash: "hash123",
			name: "测试种子",
			files: [{ id: 0, name: "file.mp4", len: 100 }],
		});

		renderTorrentDetail("/torrent?magnet=maglink");

		await waitFor(() => {
			expect(screen.getByText("测试种子")).toBeInTheDocument();
		});

		fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
		expect(getCurrentLocation()?.pathname).not.toBe("/");

		fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
		expect(getCurrentLocation()?.pathname).toBe("/");
	});

	it("在加载种子的过程中如果组件卸载，应该正常清理而不设置状态或显示 Toast 提示", async () => {
		let resolvePromise: (val: AddTorrentResult) => void = () => {};
		const mockPromise = new Promise<AddTorrentResult>((resolve) => {
			resolvePromise = resolve;
		});

		vi.mocked(mockTorrentRepository.addTorrentMagnet).mockReturnValue(
			mockPromise,
		);

		const { unmount } = renderTorrentDetail("/torrent?magnet=maglink");

		unmount();

		await act(async () => {
			resolvePromise({
				info_hash: "hash123",
				name: "测试",
				files: [],
			});
		});
	});

	it("应该能通过 infoHash（不带 magnet）加载已缓存的种子文件列表，并且可以点击播放", async () => {
		const mockFiles = [{ id: 0, name: "cached_file.mp4", len: 1000 }];

		vi.mocked(mockTorrentRepository.getTorrentFiles).mockResolvedValue(
			mockFiles,
		);

		renderTorrentDetail("/torrent?infoHash=hashCached");

		await waitFor(() => {
			expect(screen.getByText("已缓存种子")).toBeInTheDocument();
			expect(screen.getByText("cached_file.mp4")).toBeInTheDocument();
		});

		const playBtn = screen.getByRole("button", { name: "▶ 播放" });
		fireEvent.click(playBtn);

		expect(getCurrentLocation()?.pathname).toBe("/play/hashCached/0");
		expect(getCurrentLocation()?.search).toContain(
			"title=%E5%B7%B2%E7%BC%93%E5%AD%98%E7%A7%8D%E5%AD%90",
		);
	});

	it("应该对解析和加载种子的非字符串错误正确进行降级处理并显示提示", async () => {
		// 1. addTorrentMagnet fails with non-string error
		vi.mocked(mockTorrentRepository.addTorrentMagnet).mockRejectedValueOnce(
			new Error("Fatal error object"),
		);
		const render1 = renderTorrentDetail("/torrent?magnet=maglink");
		await waitFor(() => {
			expect(screen.getByText("错误详情请见控制台")).toBeInTheDocument();
		});
		render1.unmount();

		// 2. getTorrentFiles fails with non-string error
		vi.mocked(mockTorrentRepository.getTorrentFiles).mockRejectedValueOnce(
			new Error("Cache missing object"),
		);
		const render2 = renderTorrentDetail("/torrent?infoHash=hash123");
		await waitFor(() => {
			expect(screen.getByText("未找到该种子的缓存")).toBeInTheDocument();
		});
		render2.unmount();
	});
});
