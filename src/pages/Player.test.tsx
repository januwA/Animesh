import { invoke } from "@tauri-apps/api/core";
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
import Player from "./Player";

vi.mock("@tauri-apps/api/core", () => ({
	invoke: vi.fn(),
}));

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
	value: {
		writeText: vi.fn(),
	},
	writable: true,
});

const currentLocation = {
	current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
	currentLocation.current = useLocation();
	return null;
};
const getCurrentLocation = () => currentLocation.current;

describe("Player 页面组件", () => {
	beforeEach(() => {
		currentLocation.current = null;
		vi.clearAllMocks();
		vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("当缺少播放参数时，应该渲染参数错误提示并Toast", async () => {
		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/play/invalid"]}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="play/:infoHash" element={<Player />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("无效的视频播放参数")).toBeInTheDocument();
			expect(screen.getByText("无法加载视频流")).toBeInTheDocument();
		});
	});

	it("应该成功初始化播放器并加载流地址与初始状态，并启动状态轮询", async () => {
		vi.useFakeTimers();

		const mockStatus = {
			info_hash: "hash123",
			name: "测试视频",
			progress_bytes: 400,
			total_bytes: 1000,
			finished: false,
			download_speed_bytes_per_sec: 100,
			paused: false,
		};

		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "torrent_get_stream_url") {
				return "http://127.0.0.1:12345/stream/hash123/0";
			}
			if (cmd === "torrent_get_status") {
				return mockStatus;
			}
			return null;
		});

		render(
			<AppContextProvider>
				<MemoryRouter
					initialEntries={[
						"/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
					]}
				>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="play/:infoHash/:fileId" element={<Player />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		// Resolve the initial mount microtasks and initialization invokes
		await act(async () => {
			await vi.runOnlyPendingTimersAsync();
		});

		// Checks progress & stats
		expect(screen.getByText("video_name.mp4")).toBeInTheDocument();
		expect(screen.getByText("来自种子: test_title")).toBeInTheDocument();
		expect(screen.getByText("下载进度: 40.00%")).toBeInTheDocument();
		expect(screen.getByText("速度: 100 B/s")).toBeInTheDocument();
		expect(screen.getByText("正在缓存...")).toBeInTheDocument();
		expect(screen.getByText("400 B")).toBeInTheDocument();
		expect(screen.getByText("1000 B")).toBeInTheDocument();

		const finishedStatus = {
			info_hash: "hash123",
			name: "测试视频",
			progress_bytes: 1000,
			total_bytes: 1000,
			finished: true,
			download_speed_bytes_per_sec: 0,
			paused: false,
		};
		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "torrent_get_status") {
				return finishedStatus;
			}
			return null;
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		expect(screen.getByText("下载进度: 100.00%")).toBeInTheDocument();
		expect(screen.getByText("速度: 未知大小/s")).toBeInTheDocument();
		expect(screen.getByText("已完成")).toBeInTheDocument();

		// Polling error (should not crash page)
		vi.mocked(invoke).mockRejectedValueOnce("Fetch status error");

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		expect(screen.getByText("下载进度: 100.00%")).toBeInTheDocument();
	});

	it("当获取流地址失败时，应该显示错误提示和Toast", async () => {
		vi.mocked(invoke).mockRejectedValueOnce(
			"Stream server port not initialized",
		);

		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/play/hash123/0"]}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="play/:infoHash/:fileId" element={<Player />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		await waitFor(() => {
			expect(
				screen.getByText("无法获取视频流，启动播放失败"),
			).toBeInTheDocument();
			expect(screen.getByText("无法加载视频流")).toBeInTheDocument();
		});
	});

	it("当复制视频流地址时，应该支持成功和失败提示，并处理未加载完毕提前点击的情况", async () => {
		vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));

		const { unmount } = render(
			<AppContextProvider>
				<MemoryRouter
					initialEntries={[
						"/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
					]}
				>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="play/:infoHash/:fileId" element={<Player />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		const copyBtn = screen.getByRole("button", { name: "📋 复制视频流地址" });
		fireEvent.click(copyBtn);
		expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

		unmount();

		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "torrent_get_stream_url") return "stream_url";
			if (cmd === "torrent_get_status") {
				return {
					info_hash: "hash123",
					name: "视频",
					progress_bytes: 0,
					total_bytes: 100,
					finished: false,
					download_speed_bytes_per_sec: 0,
				};
			}
			return null;
		});

		render(
			<AppContextProvider>
				<MemoryRouter
					initialEntries={[
						"/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
					]}
				>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="play/:infoHash/:fileId" element={<Player />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("来自种子: test_title")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		const copyBtnLoaded = screen.getByRole("button", {
			name: "📋 复制视频流地址",
		});

		// Success path
		fireEvent.click(copyBtnLoaded);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith("stream_url");
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(
			screen.getByText("视频流地址已复制到剪贴板，可在外部播放器中播放"),
		).toBeInTheDocument();

		// Failure path
		vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
			new Error("Clipboard block"),
		);
		fireEvent.click(copyBtnLoaded);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getByText("复制失败，请手动复制")).toBeInTheDocument();
	});

	it("当点击返回按钮时，应该能够根据是否有 magnet 参数分别进行路由跳转", async () => {
		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "torrent_get_stream_url") return "stream_url";
			if (cmd === "torrent_get_status") {
				return {
					info_hash: "hash123",
					name: "视频",
					progress_bytes: 0,
					total_bytes: 100,
					finished: false,
					download_speed_bytes_per_sec: 0,
				};
			}
			return null;
		});

		// 1. Has magnet parameter
		const render1 = render(
			<AppContextProvider>
				<MemoryRouter
					initialEntries={[
						"/play/hash123/0?magnet=magnet_url&title=title_val&fileName=file_val",
					]}
				>
					<LocationTracker />
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="play/:infoHash/:fileId" element={<Player />} />
							<Route path="torrent" element={<div>Torrent Page</div>} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "返回文件列表" }),
			).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "返回文件列表" }));
		expect(getCurrentLocation()?.pathname).toBe("/torrent");
		expect(getCurrentLocation()?.search).toContain("magnet=magnet_url");
		expect(getCurrentLocation()?.search).toContain("title=title_val");

		render1.unmount();
		currentLocation.current = null;

		// 2. Does NOT have magnet parameter
		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/play/hash123/0?title=title_val"]}>
					<LocationTracker />
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="play/:infoHash/:fileId" element={<Player />} />
							<Route path="torrent" element={<div>Torrent Page</div>} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "返回文件列表" }),
			).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "返回文件列表" }));
		expect(getCurrentLocation()?.pathname).toBe("/torrent");
		expect(getCurrentLocation()?.search).not.toContain("magnet=");
		expect(getCurrentLocation()?.search).toContain("infoHash=hash123");
	});

	it("在加载流地址和状态的过程中如果组件卸载，应该正常清理而不设置状态或启动定时器", async () => {
		let resolveUrlPromise: (value: string) => void = () => {};
		const urlPromise = new Promise<string>((resolve) => {
			resolveUrlPromise = resolve;
		});

		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "torrent_get_stream_url") return urlPromise;
			return null;
		});

		const { unmount } = render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/play/hash123/0"]}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="play/:infoHash/:fileId" element={<Player />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		unmount();

		await act(async () => {
			resolveUrlPromise("stream_url_value");
		});
	});
});
