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
import { createDIContainerForTest, DIProvider } from "../di/DIContext";
import type { TorrentRepository } from "../domain/torrent/TorrentRepository";
import type { SearchResultItem } from "../types";
import Home from "./Home";

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
	value: {
		writeText: vi.fn(),
	},
	writable: true,
});

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("@/components/ui/select", () => {
	return {
		Select: ({
			children,
			value,
			onValueChange,
			disabled,
		}: {
			children: React.ReactNode;
			value?: string;
			onValueChange: (v: string) => void;
			disabled?: boolean;
		}) => (
			<select
				value={value}
				onChange={(e) => onValueChange(e.target.value)}
				disabled={disabled}
			>
				{children}
			</select>
		),
		SelectTrigger: ({ children }: { children: React.ReactNode }) => (
			<span>{children}</span>
		),
		SelectValue: () => null,
		SelectContent: ({ children }: { children: React.ReactNode }) => (
			<>{children}</>
		),
		SelectItem: ({
			children,
			value,
		}: {
			children: React.ReactNode;
			value: string;
		}) => <option value={value}>{children}</option>,
	};
});

const currentLocation = {
	current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
	currentLocation.current = useLocation();
	return null;
};

describe("Home 页面组件", () => {
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
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockReturnValue(new Promise(() => {})),
			},
		});

		currentLocation.current = null;
		vi.clearAllMocks();
		vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const renderHome = (initialRoute = "/") => {
		return render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={[initialRoute]}>
						{initialRoute === "/" && <LocationTracker />}
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route index element={<Home />} />
								<Route path="torrent" element={<div>TorrentDetail Page</div>} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);
	};

	it("应该正确渲染搜索表单和欢迎指南", () => {
		renderHome();
		expect(
			screen.getByPlaceholderText("输入动漫名称，例如：凡人修仙传..."),
		).toBeInTheDocument();
		expect(screen.getByText("聚合搜索")).toBeInTheDocument();
	});

	it("应该在组件挂载时读取 URL 的 keyword 参数并自动触发搜索", async () => {
		const mockResults = [
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];
		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);

		renderHome("/?keyword=凡人");

		await waitFor(() => {
			expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		});
		expect(mockTorrentRepository.search).toHaveBeenCalledWith("凡人", "dmhy");
	});

	it("当输入关键词并搜索成功时，应该显示结果", async () => {
		const mockResults = [
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];

		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);

		renderHome();

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);

		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.submit(input);

		expect(screen.getByText(/正在获取 动漫花园 资源列表/)).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		});

		expect(document.querySelector(".results-count")?.textContent?.trim()).toBe(
			"找到 1 个资源",
		);
		expect(mockTorrentRepository.search).toHaveBeenCalledWith("凡人", "dmhy");
	});

	it("当搜索返回空/undefined结果时，应该降级使用空数组并显示无资源提示", async () => {
		vi.mocked(mockTorrentRepository.search).mockResolvedValue(
			null as unknown as SearchResultItem[],
		);

		renderHome();

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.submit(input);

		await waitFor(() => {
			expect(
				screen.getByText("未找到相关资源，请换个关键词试试"),
			).toBeInTheDocument();
		});
	});

	it("当输入空白关键词并提交时，不应该触发搜索", async () => {
		renderHome();

		const input = screen.getByPlaceholderText(
				"输入动漫名称，例如：凡人修仙传...",
			),
			button = screen.getByRole("button", { name: "搜索" });

		fireEvent.change(input, { target: { value: "   " } });
		fireEvent.click(button);

		expect(mockTorrentRepository.search).not.toHaveBeenCalled();
	});

	it("当搜索失败时，应该显示错误提示", async () => {
		vi.mocked(mockTorrentRepository.search).mockRejectedValue("网络请求超时");

		renderHome();

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.submit(input);

		await waitFor(() => {
			expect(screen.getByText("网络请求超时")).toBeInTheDocument();
		});
	});

	it("当搜索抛出非字符串错误时，应该显示默认错误提示", async () => {
		vi.mocked(mockTorrentRepository.search).mockRejectedValueOnce(
			new Error("Internal Server Error"),
		);

		renderHome();

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.submit(input);

		await waitFor(() => {
			expect(
				screen.getByText("搜索失败，请检查网络或重试"),
			).toBeInTheDocument();
		});
	});

	it("当点击复制磁力按钮成功时，应该显示Toast提示", async () => {
		const mockResults = [
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];
		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);

		renderHome();

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.submit(input);

		await waitFor(() => {
			expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		const copyBtn = screen.getByRole("button", { name: "🧲 复制磁力" });
		fireEvent.click(copyBtn);

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			"magnet:?xt=urn:btih:TEST1",
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getByText("磁力链接已复制到剪贴板")).toBeInTheDocument();
	});

	it("当复制磁力链接失败时，应该显示失败的Toast提示", async () => {
		const mockResults = [
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];
		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);
		vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
			new Error("Permission denied"),
		);

		renderHome();

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.submit(input);

		await waitFor(() => {
			expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		const copyBtn = screen.getByRole("button", { name: "🧲 复制磁力" });
		fireEvent.click(copyBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getByText("复制失败，请手动复制")).toBeInTheDocument();
	});

	it("当点击边下边播时，应该显示启动流媒体引擎提示并跳转", async () => {
		const mockResults = [
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];
		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);

		renderHome();

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.submit(input);

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
			screen.getByText("正在启动下载流媒体引擎: 凡人修仙传 第1集..."),
		).toBeInTheDocument();

		expect(currentLocation.current?.pathname).toBe("/torrent");
		expect(currentLocation.current?.search).toContain("magnet=");
		expect(currentLocation.current?.search).toContain("title=");
	});

	it("当挂载时从 URL 读取 keyword 触发的搜索失败（字符串错误）时，应该显示错误提示", async () => {
		vi.mocked(mockTorrentRepository.search).mockRejectedValue("网络请求超时");

		renderHome("/?keyword=凡人");

		await waitFor(() => {
			expect(screen.getByText("网络请求超时")).toBeInTheDocument();
		});
	});

	it("当挂载时从 URL 读取 keyword 触发的搜索失败（非字符串错误）时，应该显示默认错误提示", async () => {
		vi.mocked(mockTorrentRepository.search).mockRejectedValue(
			new Error("error"),
		);

		renderHome("/?keyword=凡人");

		await waitFor(() => {
			expect(
				screen.getByText("搜索失败，请检查网络或重试"),
			).toBeInTheDocument();
		});
	});

	it("当选择萌番组搜索引擎并搜索时，应该使用相应的搜索引擎", async () => {
		const mockResults = [
			{
				title: "萌番组资源 1",
				link: "https://bangumi.moe/torrent/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TESTBM",
				size: 500000000,
			},
		];
		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);

		renderHome();

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });

		const select = screen.getByRole("combobox");
		fireEvent.change(select, { target: { value: "bangumi_moe" } });

		fireEvent.submit(input);

		await waitFor(() => {
			expect(mockTorrentRepository.search).toHaveBeenCalledWith(
				"凡人",
				"bangumi_moe",
			);
			expect(screen.getByText("萌番组资源 1")).toBeInTheDocument();
		});
	});

	it("应该支持切换到蜜柑计划搜索引擎并触发对应的搜索逻辑", async () => {
		const mockResults = [
			{
				title: "蜜柑计划资源 1",
				link: "https://mikanani.me/Home/Episode/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TESTMIKAN",
				size: 600000000,
			},
		];
		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);

		renderHome();

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });

		const select = screen.getByRole("combobox");
		fireEvent.change(select, { target: { value: "mikan" } });

		fireEvent.submit(input);

		await waitFor(() => {
			expect(mockTorrentRepository.search).toHaveBeenCalledWith(
				"凡人",
				"mikan",
			);
			expect(screen.getByText("蜜柑计划资源 1")).toBeInTheDocument();
		});
	});

	it("应该支持切换到 Nyaa 搜索引擎并触发对应的搜索逻辑", async () => {
		const mockResults = [
			{
				title: "Nyaa资源 1",
				link: "https://nyaa.si/view/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TESTNYAA",
				size: 700000000,
			},
		];
		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);

		renderHome();

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });

		const select = screen.getByRole("combobox");
		fireEvent.change(select, { target: { value: "nyaa" } });

		fireEvent.submit(input);

		await waitFor(() => {
			expect(mockTorrentRepository.search).toHaveBeenCalledWith("凡人", "nyaa");
			expect(screen.getByText("Nyaa资源 1")).toBeInTheDocument();
		});
	});
});
