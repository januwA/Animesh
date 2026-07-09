import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import type { TorrentRepository } from "@/domain/torrent/TorrentRepository";
import { createDIContainerForTest } from "@/test/test-utils";
import Layout from "../components/Layout";
import { AppContextProvider } from "../context/AppContext";
import Player from "./Player";

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
	value: {
		writeText: vi.fn(),
	},
	writable: true,
});

if (typeof URL.createObjectURL === "undefined") {
	URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
}
if (typeof URL.revokeObjectURL === "undefined") {
	URL.revokeObjectURL = vi.fn();
}

const currentLocation = {
	current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
	currentLocation.current = useLocation();
	return null;
};
const getCurrentLocation = () => currentLocation.current;

describe("Player 页面组件", () => {
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
			subscribeTorrents: vi.fn().mockImplementation((onUpdate) => {
				const runInitial = async () => {
					try {
						const status = await mockTorrentRepository.getTorrentStatus("");
						onUpdate([status]);
					} catch {}
				};
				runInitial();

				const interval = setInterval(async () => {
					try {
						const status = await mockTorrentRepository.getTorrentStatus("");
						onUpdate([status]);
					} catch {}
				}, 1500);

				return Promise.resolve(() => clearInterval(interval));
			}),
		};

		mockContainer = createDIContainerForTest({
			torrentRepository: mockTorrentRepository,
		});

		currentLocation.current = null;
		vi.clearAllMocks();
		vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);

		const mockTracksList: any = [
			{
				id: "1",
				mode: "disabled",
			},
			{
				id: "2",
				mode: "disabled",
			},
			{
				id: "3",
				mode: "disabled",
			},
		];
		const addTrackListeners: any[] = [];
		mockTracksList.addEventListener = vi.fn((event, listener) => {
			if (event === "addtrack") {
				addTrackListeners.push(listener);
			}
		});
		mockTracksList.removeEventListener = vi.fn((event, listener) => {
			if (event === "addtrack") {
				const index = addTrackListeners.indexOf(listener);
				if (index > -1) {
					addTrackListeners.splice(index, 1);
				}
			}
		});
		mockTracksList.triggerAddTrack = () => {
			for (const listener of addTrackListeners) {
				listener();
			}
		};

		Object.defineProperty(HTMLMediaElement.prototype, "textTracks", {
			configurable: true,
			writable: true,
			value: mockTracksList,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const renderPlayer = (
		initialEntry: string,
		initialEntries = [initialEntry],
	) => {
		return render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter
						initialEntries={initialEntries}
						initialIndex={initialEntries.indexOf(initialEntry)}
					>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route path="play/:infoHash" element={<Player />} />
								<Route path="play/:infoHash/:fileId" element={<Player />} />
								<Route path="torrent" element={<div>Torrent Page</div>} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);
	};

	it("当缺少播放参数时，应该渲染参数错误提示并Toast", async () => {
		renderPlayer("/play/invalid");

		await waitFor(() => {
			expect(screen.getByText("无效的视频播放参数")).toBeInTheDocument();
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
			peers_connected: 0,
			peers_total: 0,
		};

		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
			"http://127.0.0.1:12345/stream/hash123/0",
		);
		vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
			mockStatus,
		);

		renderPlayer(
			"/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
		);

		// Resolve the initial mount microtasks and initialization invokes
		await act(async () => {
			await vi.runOnlyPendingTimersAsync();
		});

		// Checks progress & stats
		expect(screen.getByText("video_name.mp4")).toBeInTheDocument();
		expect(screen.getByText("来自种子: test_title")).toBeInTheDocument();
		expect(screen.getByText("下载进度: 40.00%")).toBeInTheDocument();
		expect(screen.getByText("速度: 100 B/s (连接: 0/0)")).toBeInTheDocument();
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
			peers_connected: 0,
			peers_total: 0,
		};
		vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
			finishedStatus,
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		expect(screen.getByText("下载进度: 100.00%")).toBeInTheDocument();
		expect(
			screen.getByText("速度: 未知大小/s (连接: 0/0)"),
		).toBeInTheDocument();
		expect(screen.getByText("已完成")).toBeInTheDocument();

		// Polling error (should not crash page)
		vi.mocked(mockTorrentRepository.getTorrentStatus).mockRejectedValueOnce(
			"Fetch status error",
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		expect(screen.getByText("下载进度: 100.00%")).toBeInTheDocument();
	});

	it("当获取流地址失败时，应该显示错误提示和Toast", async () => {
		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockRejectedValueOnce(
			"Stream server port not initialized",
		);

		renderPlayer("/play/hash123/0");

		await waitFor(() => {
			expect(
				screen.getByText("无法获取视频流", { exact: false }),
			).toBeInTheDocument();
		});
	});

	it("当复制视频流地址时，应该支持成功和失败提示，并处理未加载完毕提前点击的情况", async () => {
		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockImplementation(
			() => new Promise(() => {}),
		);

		const { unmount } = renderPlayer(
			"/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
		);

		const copyBtn = screen.getByRole("button", { name: "复制视频流地址" });
		fireEvent.click(copyBtn);
		expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

		unmount();

		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
			"stream_url",
		);
		vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
			info_hash: "hash123",
			name: "视频",
			progress_bytes: 0,
			total_bytes: 100,
			finished: false,
			download_speed_bytes_per_sec: 0,
			paused: false,
			peers_connected: 0,
			peers_total: 0,
		});

		renderPlayer(
			"/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
		);

		await waitFor(() => {
			expect(screen.getByText("来自种子: test_title")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		const copyBtnLoaded = screen.getByRole("button", {
			name: "复制视频流地址",
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

	it("当点击返回按钮时，应该能够返回上一页", async () => {
		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
			"stream_url",
		);
		vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
			info_hash: "hash123",
			name: "视频",
			progress_bytes: 0,
			total_bytes: 100,
			finished: false,
			download_speed_bytes_per_sec: 0,
			paused: false,
			peers_connected: 0,
			peers_total: 0,
		});

		// 1. Has magnet parameter in history
		const render1 = renderPlayer(
			"/play/hash123/0?magnet=magnet_url&title=title_val&fileName=file_val",
			[
				"/torrent?magnet=magnet_url",
				"/play/hash123/0?magnet=magnet_url&title=title_val&fileName=file_val",
			],
		);

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "返回" }));
		expect(getCurrentLocation()?.pathname).toBe("/torrent");

		render1.unmount();
		currentLocation.current = null;

		// 2. Does NOT have magnet parameter in history
		renderPlayer("/play/hash123/0?title=title_val", [
			"/torrent?infoHash=hash123",
			"/play/hash123/0?title=title_val",
		]);

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "返回" }));
		expect(getCurrentLocation()?.pathname).toBe("/torrent");
	});

	it("在加载流地址和状态的过程中如果组件卸载，应该正常清理而不设置状态或启动定时器", async () => {
		let resolveUrlPromise: (value: string) => void = () => {};
		const urlPromise = new Promise<string>((resolve) => {
			resolveUrlPromise = resolve;
		});

		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockReturnValue(
			urlPromise,
		);

		const { unmount } = renderPlayer("/play/hash123/0");

		unmount();

		await act(async () => {
			resolveUrlPromise("stream_url_value");
		});
	});

	it("在订阅建立的过程中如果组件被卸载，应该在订阅成功建立后立即执行取消订阅", async () => {
		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
			"http://127.0.0.1/stream",
		);
		vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
			info_hash: "hash123",
			name: "测试视频",
			progress_bytes: 400,
			total_bytes: 1000,
			finished: false,
			download_speed_bytes_per_sec: 100,
			paused: false,
			peers_connected: 0,
			peers_total: 0,
		});

		let resolveUnsubscribePromise: (value: any) => void = () => {};
		const unsubscribePromise = new Promise<any>((resolve) => {
			resolveUnsubscribePromise = resolve;
		});
		vi.mocked(mockTorrentRepository.subscribeTorrents).mockReturnValue(
			unsubscribePromise,
		);

		const { unmount } = renderPlayer("/play/hash123/0");

		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		unmount();

		const mockUnsub = vi.fn();
		await act(async () => {
			resolveUnsubscribePromise(mockUnsub);
		});

		expect(mockUnsub).toHaveBeenCalled();
	});

	it("应该成功获取字幕轨道并支持切换字幕轨道", async () => {
		vi.useFakeTimers();

		const mockStatus = {
			info_hash: "hash123",
			name: "测试视频",
			progress_bytes: 400,
			total_bytes: 1000,
			finished: false,
			download_speed_bytes_per_sec: 100,
			paused: false,
			peers_connected: 0,
			peers_total: 0,
		};

		const mockSubtracks = [
			{ id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
			{ id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/ASS" },
			{ id: 3, language: "", title: "", codec: "S_TEXT/UTF8" },
		];

		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
			"http://127.0.0.1:12345/stream/hash123/0",
		);
		vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
			mockStatus,
		);
		vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue(
			mockSubtracks,
		);
		vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue(
			"WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
		);

		renderPlayer(
			"/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mkv",
		);

		await act(async () => {
			await vi.runOnlyPendingTimersAsync();
		});

		// Trigger the addtrack event listener to cover handleAddTrack
		const textTracks = HTMLMediaElement.prototype.textTracks;
		if (
			textTracks &&
			typeof (textTracks as any).triggerAddTrack === "function"
		) {
			(textTracks as any).triggerAddTrack();
		}

		// Verify the select trigger is rendered
		expect(screen.getByText("字幕轨道:")).toBeInTheDocument();
		const selectTrigger = screen.getByRole("combobox");
		expect(selectTrigger).toBeInTheDocument();
		// Defaults to the first subtitle
		expect(selectTrigger).toHaveTextContent("English [ENG]");

		expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledWith(
			"hash123",
			0,
			1,
		);

		// Open dropdown
		fireEvent.click(selectTrigger);

		// Click to select the Chinese subtitle (to trigger revoking of English subtitle prev URL)
		const chiItem = screen.getByText("Chinese [CHI]");
		fireEvent.click(chiItem);

		await act(async () => {
			await vi.runOnlyPendingTimersAsync();
		});

		expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledWith(
			"hash123",
			0,
			2,
		);

		// Open dropdown again
		fireEvent.click(selectTrigger);

		// Click to select track 3 (to cover empty title, language fallbacks)
		const track3Item = screen.getByText("轨道 3 []");
		fireEvent.click(track3Item);

		await act(async () => {
			await vi.runOnlyPendingTimersAsync();
		});

		expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledWith(
			"hash123",
			0,
			3,
		);

		// Open dropdown again and select "无"
		fireEvent.click(selectTrigger);
		const noneItem = screen.getByText("无");
		fireEvent.click(noneItem);

		await act(async () => {
			await vi.runOnlyPendingTimersAsync();
		});
	});

	it("当获取字幕轨道列表失败时，应该优雅处理并打印错误", async () => {
		vi.useFakeTimers();
		const mockStatus = {
			info_hash: "hash123",
			name: "测试视频",
			progress_bytes: 400,
			total_bytes: 1000,
			finished: false,
			download_speed_bytes_per_sec: 100,
			paused: false,
			peers_connected: 0,
			peers_total: 0,
		};

		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
			"http://127.0.0.1:12345/stream/hash123/0",
		);
		vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
			mockStatus,
		);
		vi.mocked(mockTorrentRepository.getSubtitleTracks).mockRejectedValue(
			new Error("Failed to load tracks"),
		);

		renderPlayer(
			"/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
		);

		await act(async () => {
			await vi.runOnlyPendingTimersAsync();
		});

		expect(screen.queryByText("字幕轨道:")).not.toBeInTheDocument();

		// Trigger the interval and wait for the polling catch block to execute
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		vi.useRealTimers();
	});

	it("当获取字幕VTT失败时，应该显示错误Toast提示", async () => {
		const mockStatus = {
			info_hash: "hash123",
			name: "测试视频",
			progress_bytes: 400,
			total_bytes: 1000,
			finished: false,
			download_speed_bytes_per_sec: 100,
			paused: false,
			peers_connected: 0,
			peers_total: 0,
		};

		const mockSubtracks = [
			{ id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
		];

		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
			"http://127.0.0.1:12345/stream/hash123/0",
		);
		vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
			mockStatus,
		);
		vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue(
			mockSubtracks,
		);
		vi.mocked(mockTorrentRepository.getSubtitleVtt).mockRejectedValue(
			new Error("VTT load error"),
		);

		renderPlayer(
			"/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
		);

		await waitFor(() => {
			expect(
				screen.getByText("加载字幕失败", { exact: false }),
			).toBeInTheDocument();
		});
	});

	it("在初始加载失败后，应该在轮询中成功加载字幕轨道", async () => {
		vi.useFakeTimers();
		const mockStatus = {
			info_hash: "hash123",
			name: "测试视频",
			progress_bytes: 400,
			total_bytes: 1000,
			finished: false,
			download_speed_bytes_per_sec: 100,
			paused: false,
			peers_connected: 0,
			peers_total: 0,
		};

		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
			"http://127.0.0.1:12345/stream/hash123/0",
		);
		vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
			mockStatus,
		);
		vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue(
			"WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
		);

		// First call fails, second call (polling) succeeds
		const mockSubtracks = [
			{ id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
		];
		vi.mocked(mockTorrentRepository.getSubtitleTracks)
			.mockRejectedValueOnce(new Error("First try fails"))
			.mockResolvedValueOnce(mockSubtracks);

		renderPlayer(
			"/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
		);

		// Flush initialization microtasks
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(screen.queryByText("字幕轨道:")).not.toBeInTheDocument();

		// Advance timers to trigger the polling which will succeed
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		// Flush microtasks
		for (let i = 0; i < 3; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}

		// Verify the subtitle tracks are now loaded and displayed
		expect(screen.getByText("字幕轨道:")).toBeInTheDocument();
		expect(screen.getByRole("combobox")).toBeInTheDocument();
		expect(screen.getByRole("combobox")).toHaveTextContent("English [ENG]");

		// Open dropdown and verify the track exists
		fireEvent.click(screen.getByRole("combobox"));
		expect(screen.getAllByText("English [ENG]").length).toBe(2);

		vi.useRealTimers();
	});

	it("应该针对各种视频加载错误提示正确的错误信息", async () => {
		vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
			"http://127.0.0.1:12345/stream/hash123/0",
		);
		vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
			info_hash: "hash123",
			name: "测试视频",
			progress_bytes: 400,
			total_bytes: 1000,
			finished: false,
			download_speed_bytes_per_sec: 100,
			paused: false,
			peers_connected: 0,
			peers_total: 0,
		});

		const { container } = renderPlayer("/play/hash123/0?fileName=test.mp4");

		let video: HTMLVideoElement | null = null;
		await waitFor(() => {
			video = container.querySelector("video");
			expect(video).toBeInTheDocument();
		});

		// 1. Test error code 4 (格式不支持)
		Object.defineProperty(video!, "error", {
			value: { code: 4 },
			configurable: true,
			writable: true,
		});
		fireEvent.error(video!);
		expect(
			screen.getByText(
				"当前浏览器不支持播放该格式（例如 MKV 容器），建议点击上方按钮“用系统播放器播放”。",
			),
		).toBeInTheDocument();

		// 2. Test error code 3 (解码失败)
		Object.defineProperty(video!, "error", {
			value: { code: 3 },
			configurable: true,
			writable: true,
		});
		fireEvent.error(video!);
		expect(
			screen.getByText("视频解码失败，可能数据已损坏或编码不支持。"),
		).toBeInTheDocument();

		// 3. Test error code 2 (网络断开)
		Object.defineProperty(video!, "error", {
			value: { code: 2 },
			configurable: true,
			writable: true,
		});
		fireEvent.error(video!);
		expect(screen.getByText("视频加载超时或网络断开。")).toBeInTheDocument();

		// 4. Test generic error (code is null/other)
		Object.defineProperty(video!, "error", {
			value: null,
			configurable: true,
			writable: true,
		});
		fireEvent.error(video!);
		expect(screen.getByText("视频加载失败")).toBeInTheDocument();
	});
});
