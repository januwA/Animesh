import { invoke } from "@tauri-apps/api/core";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type React from "react";
import {
	createMemoryRouter,
	MemoryRouter,
	Route,
	Routes,
} from "react-router-dom";
import { vi } from "vitest";
import OriginalApp, { routes } from "./App";
import { AppContextProvider, useAppContext } from "./context/AppContext";

// Wrap App for testing compatibility to automatically inject a memory router
const App = (props: Partial<Parameters<typeof OriginalApp>[0]>) => {
	const router =
		props.router ||
		createMemoryRouter(routes, {
			initialEntries: [window.location.hash.replace(/^#/, "") || "/"],
		});
	return <OriginalApp {...props} router={router} />;
};

import { createDefaultDIContainer, DIProvider } from "./di/DIContext";

const defaultDIContainer = createDefaultDIContainer();
const renderWithDI = (ui: React.ReactElement) =>
	render(<DIProvider value={defaultDIContainer}>{ui}</DIProvider>);

import Downloads from "./pages/Downloads";
import Player from "./pages/Player";
import Settings from "./pages/Settings";
import TorrentDetail from "./pages/TorrentDetail";
import type { TorrentStatusInfo } from "./types";

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

describe("App 组件", () => {
	beforeEach(() => {
		window.location.hash = "";
		vi.clearAllMocks();
		vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
		// Mock bangumiRepository to return a non-resolving promise to prevent async state updates and act warnings in tests
		defaultDIContainer.bangumiRepository = {
			getCalendar: vi.fn().mockReturnValue(new Promise(() => {})),
		};
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("应该正确渲染标题 and 副标题", () => {
		render(<App />);
		expect(
			screen.getByRole("heading", { name: "Animesh" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("BT 边下边播 & 磁力聚合搜索客户端"),
		).toBeInTheDocument();
	});

	it("当输入关键词并搜索成功时，应该显示结果并可以点击操作", async () => {
		const mockResults = [
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000, // ~333.79 MB
			},
			{
				title: "凡人修仙传 第2集",
				link: "http://example.com/2",
				pub_date: "2026-06-24",
				magnet: "magnet:?xt=urn:btih:TEST2",
				size: 1500, // ~1.46 KB
			},
			{
				title: "凡人修仙传 第3集",
				link: "http://example.com/3",
				pub_date: "2026-06-25",
				magnet: "magnet:?xt=urn:btih:TEST3",
				size: 0, // 未知大小
			},
			{
				title: "凡人修仙传 第4集",
				link: "http://example.com/4",
				pub_date: "2026-06-26",
				magnet: "magnet:?xt=urn:btih:TEST4",
				size: null, // 未知大小
			},
			{
				title: "凡人修仙传 第5集",
				link: "http://example.com/5",
				pub_date: "2026-06-27",
				magnet: "magnet:?xt=urn:btih:TEST5",
				// size is undefined
			},
		];

		const mockAddTorrentResult = {
			info_hash: "3a2a3e0f438a2e1d74381395bb0e6840742fef8e",
			name: "凡人修仙传 第1集",
			files: [
				{ id: 0, name: "video1.mp4", len: 1000000 },
				{ id: 1, name: "subtitle.srt", len: 5000 },
			],
		};

		vi.mocked(invoke).mockImplementation(async (cmd, _args) => {
			if (cmd === "search_dmhy" || cmd === "search_torrents") {
				return mockResults;
			}
			if (cmd === "torrent_add_magnet") {
				return mockAddTorrentResult;
			}
			return null;
		});

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		const button = screen.getByRole("button", { name: "搜索" });

		// 输入关键词并搜索
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.click(button);

		// 应该进入 loading 状态
		expect(
			screen.getByText("正在获取 动漫花园 资源列表..."),
		).toBeInTheDocument();

		// 等待加载完成并显示结果
		await waitFor(() => {
			const count = document.querySelector(".results-count");
			expect(count).toBeInTheDocument();
			expect(count?.textContent?.replace(/\s+/g, " ").trim()).toBe(
				"找到 5 个资源",
			);
		});

		expect(invoke).toHaveBeenCalledWith("search_torrents", {
			keyword: "凡人",
			engine: "dmhy",
		});

		// 检查资源渲染
		expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		expect(screen.getByText("333.79 MB")).toBeInTheDocument();
		expect(screen.getByText("1.46 KB")).toBeInTheDocument();
		const unknownSizes = screen.getAllByText("未知大小");
		expect(unknownSizes.length).toBeGreaterThanOrEqual(3);

		// 开启 fake timers
		vi.useFakeTimers();

		// 点击复制磁力按钮
		const copyButtons = screen.getAllByRole("button", { name: "🧲 复制磁力" });
		fireEvent.click(copyButtons[0]);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			"magnet:?xt=urn:btih:TEST1",
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getByText("磁力链接已复制到剪贴板")).toBeInTheDocument();

		// 推进 3000ms 让 Toast 消失
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(
			screen.queryByText("磁力链接已复制到剪贴板"),
		).not.toBeInTheDocument();

		// 暂时切回 real timers 确保状态干净，然后切到 fake timers 触发播放
		vi.useRealTimers();
		vi.useFakeTimers();

		// 点击边下边播按钮
		const playButtons = screen.getAllByRole("button", { name: "▶ 边下边播" });
		fireEvent.click(playButtons[0]);

		// 应该展示“正在启动下载流媒体引擎”的 Toast
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(
			screen.getByText("正在启动下载流媒体引擎: 凡人修仙传 第1集..."),
		).toBeInTheDocument();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(
			screen.queryByText("正在启动下载流媒体引擎: 凡人修仙传 第1集..."),
		).not.toBeInTheDocument();

		vi.useRealTimers();
	});

	it("当搜索失败时，应该显示错误提示", async () => {
		vi.mocked(invoke).mockRejectedValue("网络请求超时");

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.submit(input); // 可以直接回车提交

		await waitFor(() => {
			expect(screen.getByText("网络请求超时")).toBeInTheDocument();
		});
	});

	it("当搜索抛出非字符串错误时，应该显示默认错误提示", async () => {
		vi.mocked(invoke).mockRejectedValueOnce(new Error("Internal Server Error"));

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));

		await waitFor(() => {
			expect(
				screen.getByText("搜索失败，请检查网络或重试"),
			).toBeInTheDocument();
		});
	});

	it("当搜索结果为空时，应该显示无资源提示", async () => {
		vi.mocked(invoke).mockResolvedValue([]);

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "不存在的动漫" } });
		fireEvent.submit(input);

		await waitFor(() => {
			expect(
				screen.getByText("未找到相关资源，请换个关键词试试"),
			).toBeInTheDocument();
		});
	});

	it("当复制磁力链接失败时，应该显示失败提示", async () => {
		vi.mocked(invoke).mockResolvedValue([
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		]);
		vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
			new Error("Permission denied"),
		);

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));

		await waitFor(() => {
			const count = document.querySelector(".results-count");
			expect(count).toBeInTheDocument();
		});

		// 在触发点击前启动 fake timers，这样 setTimeout 就会注册在 fake timer 队列里
		vi.useFakeTimers();

		const copyBtn = screen.getByRole("button", { name: "🧲 复制磁力" });
		fireEvent.click(copyBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getByText("复制失败，请手动复制")).toBeInTheDocument();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(screen.queryByText("复制失败，请手动复制")).not.toBeInTheDocument();

		vi.useRealTimers();
	});

	it("当输入空白关键词并提交时，不应该触发搜索", async () => {
		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "   " } });
		fireEvent.submit(input);

		expect(invoke).not.toHaveBeenCalled();
	});

	it("当点击边下边播成功解析磁力时，应该打开文件选择弹窗，并且能进入播放和控制界面", async () => {
		const mockResults = [
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];

		const mockAddTorrentResult = {
			info_hash: "3a2a3e0f438a2e1d74381395bb0e6840742fef8e",
			name: "凡人修仙传 第1集",
			files: [
				{ id: 0, name: "video1.mp4", len: 1000000 },
				{ id: 1, name: "subtitle.srt", len: 5000 },
			],
		};

		const mockStatus = {
			info_hash: "3a2a3e0f438a2e1d74381395bb0e6840742fef8e",
			name: "凡人修仙传 第1集",
			progress_bytes: 400000,
			total_bytes: 1000000,
			finished: false,
			download_speed_bytes_per_sec: 25000,
		};

		vi.mocked(invoke).mockImplementation(async (cmd, _args) => {
			if (cmd === "search_dmhy" || cmd === "search_torrents")
				return mockResults;
			if (cmd === "torrent_add_magnet") return mockAddTorrentResult;
			if (cmd === "torrent_get_stream_url") {
				return "http://127.0.0.1:12345/stream/3a2a3e0f438a2e1d74381395bb0e6840742fef8e/0";
			}
			if (cmd === "torrent_get_status") {
				// 模拟一个略带延迟的 Promise，用以获取中间状态（torrentStatus 还是 null）
				return new Promise((resolve) =>
					setTimeout(() => resolve(mockStatus), 10),
				);
			}
			return null;
		});

		render(<App />);

		// 搜索
		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));

		await waitFor(() => {
			expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		});

		// 开启 fake timers 来支持轮询和 Toast
		vi.useFakeTimers();

		// 点击边下边播
		const playBtn = screen.getByRole("button", { name: "▶ 边下边播" });
		fireEvent.click(playBtn);

		// 此时应该正在解析种子并加载
		expect(
			screen.getByText("正在启动下载引擎并解析种子..."),
		).toBeInTheDocument();

		// 连续推进 microtask 队列以完成 add_magnet 的 promise
		for (let i = 0; i < 3; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}

		// 加载遮罩应该关闭，并显示文件列表面板
		expect(
			screen.queryByText("正在启动下载引擎并解析种子..."),
		).not.toBeInTheDocument();
		expect(screen.getByText("选择要播放的文件：")).toBeInTheDocument();
		expect(screen.getByText("video1.mp4")).toBeInTheDocument();
		expect(screen.getByText("subtitle.srt")).toBeInTheDocument();

		// 点击播放第一个文件
		const filePlayBtns = screen.getAllByRole("button", { name: "▶ 播放" });
		fireEvent.click(filePlayBtns[0]);

		// 推进第一步：加载 streamUrl 和 activeFileId，但此时 torrentStatus 依然为 null
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		// 检查渲染了“计算中...”和“0 B/s”分支（覆盖 torrentStatus 为 null 时的分支）
		expect(screen.getByText("下载进度: 计算中...")).toBeInTheDocument();
		expect(screen.getByText("速度: 0 B/s")).toBeInTheDocument();
		expect(screen.getByText("连接中...")).toBeInTheDocument();

		// 推进 10ms 释放并解决获取初始状态的延时 Promise
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10);
		});

		// 此时应该展示播放器和进度条等状态
		expect(screen.getByText("下载进度: 40.00%")).toBeInTheDocument();
		expect(screen.getByText("速度: 24.41 KB/s")).toBeInTheDocument();
		expect(screen.getByText("正在缓存...")).toBeInTheDocument();

		// 推进以执行轮询定时器逻辑
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		// 覆盖 interval 错误逻辑
		vi.mocked(invoke).mockImplementationOnce(async (cmd) => {
			if (cmd === "torrent_get_status") throw "Fetch status failed";
			return null;
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		// 模拟复制流地址
		const copyStreamBtn = screen.getByRole("button", {
			name: "📋 复制视频流地址",
		});
		fireEvent.click(copyStreamBtn);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			"http://127.0.0.1:12345/stream/3a2a3e0f438a2e1d74381395bb0e6840742fef8e/0",
		);

		for (let i = 0; i < 2; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}
		expect(
			screen.getByText("视频流地址已复制到剪贴板，可在外部播放器中播放"),
		).toBeInTheDocument();

		// 模拟复制流地址失败情况
		vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
			new Error("Permission denied"),
		);
		fireEvent.click(copyStreamBtn);
		for (let i = 0; i < 2; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}
		expect(screen.getByText("复制失败，请手动复制")).toBeInTheDocument();

		// 测试返回文件列表
		const backBtn = screen.getByRole("button", { name: "返回文件列表" });
		fireEvent.click(backBtn);
		for (let i = 0; i < 2; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}
		expect(screen.getByText("选择要播放的文件：")).toBeInTheDocument();

		// 测试关闭弹窗
		const closeBtn = screen.getByRole("button", { name: "✕" });
		fireEvent.click(closeBtn);
		for (let i = 0; i < 2; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}
		expect(screen.queryByText("选择要播放的文件：")).not.toBeInTheDocument();

		vi.useRealTimers();
	});

	it("当播放获取流媒体 URL 失败时，应该显示错误提示", async () => {
		const mockResults = [
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];

		const mockAddTorrentResult = {
			info_hash: "3a2a3e0f438a2e1d74381395bb0e6840742fef8e",
			name: "凡人修仙传 第1集",
			files: [{ id: 0, name: "video1.mp4", len: 1000000 }],
		};

		vi.mocked(invoke).mockImplementation(async (cmd, _args) => {
			if (cmd === "search_dmhy" || cmd === "search_torrents")
				return mockResults;
			if (cmd === "torrent_add_magnet") return mockAddTorrentResult;
			if (cmd === "torrent_get_stream_url") {
				throw "Stream server port not initialized";
			}
			return null;
		});

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));

		await waitFor(() => {
			expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		// 点击播放
		fireEvent.click(screen.getByRole("button", { name: "▶ 边下边播" }));
		for (let i = 0; i < 3; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}
		expect(screen.getByText("选择要播放的文件：")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "▶ 播放" }));
		for (let i = 0; i < 4; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}
		expect(
			screen.getByText("无法获取视频流，启动播放失败"),
		).toBeInTheDocument();

		vi.useRealTimers();
	});

	it("当解析种子失败时，应该显示解析失败的 Toast 提示", async () => {
		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "search_dmhy" || cmd === "search_torrents") {
				return [
					{
						title: "凡人修仙传 第1集",
						link: "http://example.com/1",
						pub_date: "2026-06-23",
						magnet: "magnet:?xt=urn:btih:TEST1",
						size: 350000000,
					},
				];
			}
			if (cmd === "torrent_add_magnet") {
				throw "解析引擎启动超时";
			}
			return null;
		});

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));

		await waitFor(() => {
			expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		const playBtn = screen.getByRole("button", { name: "▶ 边下边播" });
		fireEvent.click(playBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		expect(
			screen.getByText("种子解析失败: 解析引擎启动超时"),
		).toBeInTheDocument();

		// Wait for error screen to render
		expect(screen.getByText("种子解析失败")).toBeInTheDocument();
		expect(screen.getByText("解析引擎启动超时")).toBeInTheDocument();

		// Click "返回搜索页面"
		const backToSearchBtn = screen.getByRole("button", {
			name: "返回搜索页面",
		});
		fireEvent.click(backToSearchBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		// Should be back to search page
		expect(
			screen.getByPlaceholderText("输入动漫名称，例如：凡人修仙传..."),
		).toBeInTheDocument();

		vi.useRealTimers();
	});

	it("当解析种子抛出非字符串错误时，应该显示默认解析错误提示", async () => {
		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "search_dmhy" || cmd === "search_torrents") {
				return [
					{
						title: "凡人修仙传 第1集",
						link: "http://example.com/1",
						pub_date: "2026-06-23",
						magnet: "magnet:?xt=urn:btih:TEST1",
						size: 350000000,
					},
				];
			}
			if (cmd === "torrent_add_magnet") {
				throw new Error("Fatal Torrent Error");
			}
			return null;
		});

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));

		await waitFor(() => {
			expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		const playBtn = screen.getByRole("button", { name: "▶ 边下边播" });
		fireEvent.click(playBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		expect(
			screen.getByText("种子解析失败: 错误详情请见控制台"),
		).toBeInTheDocument();

		vi.useRealTimers();
	});

	it("应该在组件卸载时清除轮询定时器，并展示未命名和已完成状态的覆盖", async () => {
		const mockResults = [
			{
				title: "凡人1",
				link: "",
				pub_date: "",
				magnet: "mag1",
				size: 100,
			},
		];
		const mockAddTorrentResult = {
			info_hash: "hash1",
			name: null, // 测试未命名种子分支
			files: [{ id: 0, name: "v.mp4", len: 100 }],
		};
		const mockStatus = {
			info_hash: "hash1",
			name: null,
			progress_bytes: 100,
			total_bytes: 100,
			finished: true, // 测试已完成状态分支
			download_speed_bytes_per_sec: 0,
		};

		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "search_dmhy" || cmd === "search_torrents")
				return mockResults;
			if (cmd === "torrent_add_magnet") return mockAddTorrentResult;
			if (cmd === "torrent_get_stream_url") return "stream_url";
			if (cmd === "torrent_get_status") return mockStatus;
			return null;
		});

		const { unmount } = render(<App />);

		// 搜索并播放以启动定时器
		fireEvent.change(
			screen.getByPlaceholderText("输入动漫名称，例如：凡人修仙传..."),
			{ target: { value: "凡人" } },
		);
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));
		await waitFor(() => expect(screen.getByText("凡人1")).toBeInTheDocument());

		vi.useFakeTimers();
		fireEvent.click(screen.getByRole("button", { name: "▶ 边下边播" }));
		for (let i = 0; i < 3; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}

		// 检查标题是否正确渲染为“未命名种子”
		expect(screen.getByText("未命名种子")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "▶ 播放" }));
		for (let i = 0; i < 4; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}

		// 检查状态是否正确渲染为“已完成”
		expect(screen.getByText("已完成")).toBeInTheDocument();

		// 卸载组件，触发 useEffect 清理
		unmount();
		vi.useRealTimers();
	});

	it("当点击 Toast 提示的关闭按钮时，应该立即关闭 Toast 提示", async () => {
		vi.mocked(invoke).mockResolvedValue([
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		]);

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));

		await waitFor(() => {
			expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		const copyBtn = screen.getByRole("button", { name: "🧲 复制磁力" });
		fireEvent.click(copyBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		const toastText = "磁力链接已复制到剪贴板";
		expect(screen.getByText(toastText)).toBeInTheDocument();

		// 点击关闭提示按钮
		const closeToastBtn = screen.getByLabelText("关闭提示");
		fireEvent.click(closeToastBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		expect(screen.queryByText(toastText)).not.toBeInTheDocument();

		vi.useRealTimers();
	});

	it("当按下 Escape 键时，应该关闭种子解析弹窗", async () => {
		const mockResults = [
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];

		const mockAddTorrentResult = {
			info_hash: "3a2a3e0f438a2e1d74381395bb0e6840742fef8e",
			name: "凡人修仙传 第1集",
			files: [{ id: 0, name: "video1.mp4", len: 1000000 }],
		};

		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "search_dmhy" || cmd === "search_torrents")
				return mockResults;
			if (cmd === "torrent_add_magnet") return mockAddTorrentResult;
			return null;
		});

		render(<App />);

		fireEvent.change(
			screen.getByPlaceholderText("输入动漫名称，例如：凡人修仙传..."),
			{ target: { value: "凡人" } },
		);
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));

		await waitFor(() => {
			expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		fireEvent.click(screen.getByRole("button", { name: "▶ 边下边播" }));

		for (let i = 0; i < 3; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}

		// 检查弹窗渲染
		expect(screen.getByText("选择要播放的文件：")).toBeInTheDocument();

		// 按下 Escape 键
		const dialogElement = screen.getByRole("dialog");
		fireEvent.keyDown(dialogElement, { key: "Escape", code: "Escape" });

		for (let i = 0; i < 2; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}
		expect(screen.queryByText("选择要播放的文件：")).not.toBeInTheDocument();

		vi.useRealTimers();
	});

	it("当在 AppContextProvider 外部使用 useAppContext 时，应该抛出错误", () => {
		const TestComponent = () => {
			useAppContext();
			return null;
		};
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => render(<TestComponent />)).toThrow(
			"useAppContext must be used within an AppContextProvider",
		);
		spy.mockRestore();
	});

	it("在 Player 页面中如果缺少播放参数，应该展示错误提示", async () => {
		renderWithDI(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/play/invalid"]}>
					<Routes>
						<Route path="/play/:infoHash" element={<Player />} />
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("无法加载视频流")).toBeInTheDocument();
		});
	});

	it("在 TorrentDetail 页面中如果缺少磁力链接，应该展示错误提示", async () => {
		renderWithDI(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/torrent"]}>
					<Routes>
						<Route path="/torrent" element={<TorrentDetail />} />
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText(/未提供有效的磁力链接/)).toBeInTheDocument();
		});
	});

	it("在 TorrentDetail 页面中点击返回和取消按钮时，应该触发导航", async () => {
		const mockResults = [
			{
				title: "凡人1",
				link: "",
				pub_date: "",
				magnet: "mag1",
				size: 100,
			},
		];
		const mockAddTorrentResult = {
			info_hash: "hash1",
			name: "凡人1",
			files: [{ id: 0, name: "v.mp4", len: 100 }],
		};

		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "search_dmhy" || cmd === "search_torrents")
				return mockResults;
			if (cmd === "torrent_add_magnet") return mockAddTorrentResult;
			return null;
		});

		render(<App />);

		// Search and click play to go to detail
		fireEvent.change(
			screen.getByPlaceholderText("输入动漫名称，例如：凡人修仙传..."),
			{ target: { value: "凡人" } },
		);
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));
		await waitFor(() => expect(screen.getByText("凡人1")).toBeInTheDocument());

		// Trigger fake timers for resolving magnet
		vi.useFakeTimers();
		fireEvent.click(screen.getByRole("button", { name: "▶ 边下边播" }));

		// Advance timers so TorrentDetail mounts
		for (let i = 0; i < 3; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}

		// Click "返回搜索" button
		const backBtn = screen.getByRole("button", { name: "返回搜索" });
		fireEvent.click(backBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		// Should be back to search page
		expect(
			screen.getByPlaceholderText("输入动漫名称，例如：凡人修仙传..."),
		).toBeInTheDocument();

		// Go back to TorrentDetail
		fireEvent.click(screen.getByRole("button", { name: "▶ 边下边播" }));
		for (let i = 0; i < 3; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
		}

		// Click "✕" button
		const closeBtn = screen.getByRole("button", { name: "✕" });
		fireEvent.click(closeBtn);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(
			screen.getByPlaceholderText("输入动漫名称，例如：凡人修仙传..."),
		).toBeInTheDocument();

		vi.useRealTimers();
	});

	it("在 TorrentDetail 页面加载中点击取消按钮，应该触发导航", async () => {
		const mockResults = [
			{
				title: "凡人1",
				link: "",
				pub_date: "",
				magnet: "mag1",
				size: 100,
			},
		];
		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "search_dmhy" || cmd === "search_torrents")
				return mockResults;
			if (cmd === "torrent_add_magnet") {
				return new Promise(() => {}); // never resolves
			}
			return null;
		});

		render(<App />);

		fireEvent.change(
			screen.getByPlaceholderText("输入动漫名称，例如：凡人修仙传..."),
			{ target: { value: "凡人" } },
		);
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));
		await waitFor(() => {
			const count = document.querySelector(".results-count");
			expect(count).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "▶ 边下边播" }));

		// Now we should be on loader page
		const cancelBtn = screen.getByRole("button", { name: "取消解析并返回" });
		fireEvent.click(cancelBtn);

		await waitFor(() => {
			expect(
				screen.getByPlaceholderText("输入动漫名称，例如：凡人修仙传..."),
			).toBeInTheDocument();
		});
	});

	it("在 Player 页面中如果在加载流地址前复制，应该提前返回且不进行复制操作", async () => {
		vi.mocked(invoke).mockImplementationOnce(async (cmd) => {
			if (cmd === "torrent_get_stream_url") {
				return new Promise(() => {}); // never resolves
			}
			return null;
		});

		renderWithDI(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/play/hash/0"]}>
					<Routes>
						<Route path="/play/:infoHash/:fileId" element={<Player />} />
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		const copyBtn = screen.getByRole("button", { name: "📋 复制视频流地址" });
		fireEvent.click(copyBtn);

		expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
	});

	it("在 Player 页面加载流地址过程中卸载组件，应该终止初始化", () => {
		const { unmount } = renderWithDI(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/play/hash/0"]}>
					<Routes>
						<Route path="/play/:infoHash/:fileId" element={<Player />} />
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);
		unmount();
	});

	it("应该可以渲染下载管理页面并展示下载任务列表，并且支持暂停、继续和删除操作", async () => {
		const mockTorrents: TorrentStatusInfo[] = [
			{
				info_hash: "hash111",
				name: "动漫视频1",
				progress_bytes: 500,
				total_bytes: 1000,
				finished: false,
				download_speed_bytes_per_sec: 100,
				paused: false,
			},
			{
				info_hash: "hash222",
				name: "动漫视频2",
				progress_bytes: 1000,
				total_bytes: 1000,
				finished: true,
				download_speed_bytes_per_sec: 0,
				paused: false,
			},
		];

		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "torrent_list") {
				return mockTorrents;
			}
			if (cmd === "torrent_pause") {
				mockTorrents[0].paused = true;
				return null;
			}
			if (cmd === "torrent_resume") {
				mockTorrents[0].paused = false;
				return null;
			}
			if (cmd === "torrent_delete") {
				return null;
			}
			return null;
		});

		renderWithDI(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/downloads"]}>
					<Routes>
						<Route path="/downloads" element={<Downloads />} />
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		// 检查标题和列表
		await waitFor(() => {
			expect(screen.getByText("📥 下载管理")).toBeInTheDocument();
			expect(screen.getByText("动漫视频1")).toBeInTheDocument();
			expect(screen.getByText("动漫视频2")).toBeInTheDocument();
		});

		// 检查进度和速度
		expect(screen.getByText(/进度: 50/)).toBeInTheDocument();
		expect(screen.getByText(/网速: 100 B/)).toBeInTheDocument();

		// 测试暂停操作
		const pauseBtn = screen.getByTitle("暂停下载");
		fireEvent.click(pauseBtn);
		await waitFor(() => {
			expect(invoke).toHaveBeenCalledWith("torrent_pause", {
				infoHash: "hash111",
			});
		});

		// 测试删除按钮触发弹窗
		const deleteBtn = screen.getAllByTitle("删除下载")[0];
		fireEvent.click(deleteBtn);
		expect(screen.getByText("删除下载任务")).toBeInTheDocument();

		// 点击确认删除
		const confirmDeleteBtn = screen.getByText("确认删除");
		fireEvent.click(confirmDeleteBtn);
		await waitFor(() => {
			expect(invoke).toHaveBeenCalledWith("torrent_delete", {
				infoHash: "hash111",
				deleteFiles: false,
			});
		});
	});

	it("应该可以渲染设置页面并可以更改下载路径", async () => {
		let currentDir = "C:\\Downloads";

		// biome-ignore lint/suspicious/noExplicitAny: mock implementation args
		vi.mocked(invoke).mockImplementation(async (cmd, args: any) => {
			if (cmd === "settings_get") {
				return { download_dir: currentDir };
			}
			if (cmd === "select_directory") {
				return "D:\\CustomDownloads";
			}
			if (cmd === "settings_set_download_dir") {
				currentDir = args.dir;
				return null;
			}
			return null;
		});

		renderWithDI(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/settings"]}>
					<Routes>
						<Route path="/settings" element={<Settings />} />
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		// 检查输入框内的值
		await waitFor(() => {
			const input = screen.getByPlaceholderText(/选择或输入下载路径/);
			expect(input).toHaveValue("C:\\Downloads");
		});

		// 点击选择目录
		const selectBtn = screen.getByText("选择目录");
		fireEvent.click(selectBtn);
		await waitFor(() => {
			expect(invoke).toHaveBeenCalledWith("select_directory");
			const input = screen.getByPlaceholderText(/选择或输入下载路径/);
			expect(input).toHaveValue("D:\\CustomDownloads");
		});

		// 点击保存
		const saveBtn = screen.getByText("保存设置");
		fireEvent.click(saveBtn);
		await waitFor(() => {
			expect(invoke).toHaveBeenCalledWith("settings_set_download_dir", {
				dir: "D:\\CustomDownloads",
			});
		});
	});
});
