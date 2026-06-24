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
import { createDIContainer, DIProvider } from "../di/DIContext";
import type { TorrentRepository } from "../domain/torrent/TorrentRepository";
import type { BangumiCalendarDay, SearchResultItem } from "../types";
import Home from "./Home";

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

describe("Home 页面组件", () => {
	let mockTorrentRepository: TorrentRepository;
	let mockContainer: DIContainer;

	beforeEach(() => {
		mockTorrentRepository = {
			searchDmhy: vi.fn(),
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

		mockContainer = createDIContainer({
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

	it("应该正确渲染搜索表单和欢迎指南", async () => {
		vi.mocked(mockContainer.bangumiRepository.getCalendar).mockResolvedValue(
			[],
		);
		renderHome();
		expect(
			screen.getByPlaceholderText("输入动漫名称，例如：凡人修仙传..."),
		).toBeInTheDocument();
		await waitFor(() => {
			expect(screen.getByText("聚合搜索")).toBeInTheDocument();
		});
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

		vi.mocked(mockTorrentRepository.searchDmhy).mockResolvedValue(mockResults);

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
		expect(mockTorrentRepository.searchDmhy).toHaveBeenCalledWith("凡人");
	});

	it("当搜索返回空/undefined结果时，应该降级使用空数组并显示无资源提示", async () => {
		vi.mocked(mockTorrentRepository.searchDmhy).mockResolvedValue(
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

		expect(mockTorrentRepository.searchDmhy).not.toHaveBeenCalled();
	});

	it("当搜索失败时，应该显示错误提示", async () => {
		vi.mocked(mockTorrentRepository.searchDmhy).mockRejectedValue(
			"网络请求超时",
		);

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
		vi.mocked(mockTorrentRepository.searchDmhy).mockRejectedValueOnce(
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
		vi.mocked(mockTorrentRepository.searchDmhy).mockResolvedValue(mockResults);

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
		vi.mocked(mockTorrentRepository.searchDmhy).mockResolvedValue(mockResults);
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
		vi.mocked(mockTorrentRepository.searchDmhy).mockResolvedValue(mockResults);

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

	it("当 bangumiRepository 返回新番更新数据时，应该展示一周新番和对应的动漫列表", async () => {
		const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
		const mockCalendar = [
			{
				weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
				items: [
					{
						id: 1,
						name: "Anime Original Name",
						name_cn: "中文动漫名",
						images: { common: "http://example.com/cover.jpg" },
						rating: { score: 8.5 },
						collection: { doing: 1200 },
						rank: 1,
					},
				],
			},
		];

		mockContainer = createDIContainer({
			torrentRepository: mockTorrentRepository,
			settingsRepository: {
				getSettings: vi.fn(),
				setDownloadDir: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue(mockCalendar),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/"]}>
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route index element={<Home />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("一周新番")).toBeInTheDocument();
		});
		expect(screen.getByText("中文动漫名")).toBeInTheDocument();
		expect(screen.getByText("8.5")).toBeInTheDocument();
		expect(screen.getByText("1,200")).toBeInTheDocument();
	});

	it("当点击新番卡片时，应该将动漫名称设置为搜索词并自动触发搜索", async () => {
		const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
		const mockCalendar = [
			{
				weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
				items: [
					{
						id: 1,
						name: "Anime Original Name",
						name_cn: "中文动漫名",
						images: { common: "http://example.com/cover.jpg" },
						rating: { score: 8.5 },
						collection: { doing: 1200 },
						rank: 1,
					},
				],
			},
		];

		vi.mocked(mockTorrentRepository.searchDmhy).mockResolvedValue(
			null as unknown as SearchResultItem[],
		);

		mockContainer = createDIContainer({
			torrentRepository: mockTorrentRepository,
			settingsRepository: {
				getSettings: vi.fn(),
				setDownloadDir: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue(mockCalendar),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/"]}>
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route index element={<Home />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("中文动漫名")).toBeInTheDocument();
		});

		const animeCard = screen.getByTitle("搜索: 中文动漫名");
		fireEvent.click(animeCard);

		await waitFor(() => {
			expect(mockTorrentRepository.searchDmhy).toHaveBeenCalledWith(
				"中文动漫名",
			);
		});
		await waitFor(() => {
			expect(screen.queryByText(/正在获取/)).not.toBeInTheDocument();
		});
	});

	it("当 bangumiRepository 请求失败时，应该降级展示欢迎指南", async () => {
		mockContainer = createDIContainer({
			torrentRepository: mockTorrentRepository,
			settingsRepository: {
				getSettings: vi.fn(),
				setDownloadDir: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockRejectedValue(new Error("API error")),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/"]}>
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route index element={<Home />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("聚合搜索")).toBeInTheDocument();
		});
	});

	it("在 WeeklyCalendar 中，点击不同的星期 tab 应该切换展示的数据且正确排序", async () => {
		const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
		const otherDayId = todayId === 1 ? 2 : 1;

		const mockCalendar = [
			{
				weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
				items: [
					{
						id: 1,
						name: "Anime Original Name",
						name_cn: "今天动漫",
						images: { common: "http://example.com/cover.jpg" },
						rating: { score: 8.5 },
						collection: { doing: 1200 },
						rank: 1,
					},
				],
			},
			{
				weekday: { id: otherDayId, en: "other", cn: "其他", ja: "other" },
				items: [
					{
						id: 2,
						name: "Other Anime 2",
						name_cn: "其他动漫2",
						rank: 2,
					},
					{
						id: 3,
						name: "Other Anime 3",
						name_cn: "其他动漫3",
						rank: undefined,
					},
					{
						id: 4,
						name: "Other Anime 4",
						name_cn: "其他动漫4",
						rank: 1,
					},
				],
			},
		];

		mockContainer = createDIContainer({
			torrentRepository: mockTorrentRepository,
			settingsRepository: {
				getSettings: vi.fn(),
				setDownloadDir: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue(mockCalendar),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/"]}>
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route index element={<Home />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("今天动漫")).toBeInTheDocument();
		});

		const labels = ["一", "二", "三", "四", "五", "六", "日"];
		const otherDayLabel = labels[otherDayId - 1];
		const tabBtn = screen.getByRole("button", { name: otherDayLabel });
		fireEvent.click(tabBtn);

		await waitFor(() => {
			expect(screen.getByText("其他动漫2")).toBeInTheDocument();
		});
		expect(screen.getByText("其他动漫3")).toBeInTheDocument();
		expect(screen.getByText("其他动漫4")).toBeInTheDocument();
	});

	it("当点击新番卡片搜索失败时，应该显示错误提示", async () => {
		const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
		const mockCalendar = [
			{
				weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
				items: [
					{
						id: 1,
						name: "Anime Original Name",
						name_cn: "中文动漫名",
						images: { common: "http://example.com/cover.jpg" },
						rating: { score: 8.5 },
						collection: { doing: 1200 },
						rank: 1,
					},
				],
			},
		];

		vi.mocked(mockTorrentRepository.searchDmhy).mockRejectedValue(
			"网络请求超时",
		);

		mockContainer = createDIContainer({
			torrentRepository: mockTorrentRepository,
			settingsRepository: {
				getSettings: vi.fn(),
				setDownloadDir: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue(mockCalendar),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/"]}>
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route index element={<Home />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("中文动漫名")).toBeInTheDocument();
		});

		const animeCard = screen.getByTitle("搜索: 中文动漫名");
		fireEvent.click(animeCard);

		await waitFor(() => {
			expect(screen.getByText("网络请求超时")).toBeInTheDocument();
		});
	});

	it("当点击新番卡片搜索抛出非字符串错误时，应该显示默认错误提示", async () => {
		const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
		const mockCalendar = [
			{
				weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
				items: [
					{
						id: 1,
						name: "Anime Original Name",
						name_cn: "中文动漫名",
						images: { common: "http://example.com/cover.jpg" },
						rating: { score: 8.5 },
						collection: { doing: 1200 },
						rank: 1,
					},
				],
			},
		];

		vi.mocked(mockTorrentRepository.searchDmhy).mockRejectedValue(
			new Error("Network Error"),
		);

		mockContainer = createDIContainer({
			torrentRepository: mockTorrentRepository,
			settingsRepository: {
				getSettings: vi.fn(),
				setDownloadDir: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue(mockCalendar),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/"]}>
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route index element={<Home />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("中文动漫名")).toBeInTheDocument();
		});

		const animeCard = screen.getByTitle("搜索: 中文动漫名");
		fireEvent.click(animeCard);

		await waitFor(() => {
			expect(
				screen.getByText("搜索失败，请检查网络或重试"),
			).toBeInTheDocument();
		});
	});

	it("当今天没有新番更新数据时，应该显示暂无更新", async () => {
		const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
		const otherDayId = todayId === 1 ? 2 : 1;
		const mockCalendar = [
			{
				weekday: { id: otherDayId, en: "other", cn: "其他", ja: "other" },
				items: [],
			},
		];

		mockContainer = createDIContainer({
			torrentRepository: mockTorrentRepository,
			settingsRepository: {
				getSettings: vi.fn(),
				setDownloadDir: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue(mockCalendar),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/"]}>
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route index element={<Home />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("暂无更新")).toBeInTheDocument();
		});
	});

	it("当组件在 calendar 请求完成前卸载时，不应该更新状态", async () => {
		let resolvePromise: (value: BangumiCalendarDay[]) => void = () => {};
		const promise = new Promise<BangumiCalendarDay[]>((resolve) => {
			resolvePromise = resolve;
		});

		mockContainer = createDIContainer({
			torrentRepository: mockTorrentRepository,
			settingsRepository: {
				getSettings: vi.fn(),
				setDownloadDir: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockReturnValue(promise),
			},
		});

		const { unmount } = render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/"]}>
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route index element={<Home />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		unmount();
		resolvePromise([]);
	});

	it("应该在星期天时将 weekday id 识别为 7", async () => {
		const getDayMock = vi.spyOn(Date.prototype, "getDay").mockReturnValue(0);

		mockContainer = createDIContainer({
			torrentRepository: mockTorrentRepository,
			settingsRepository: {
				getSettings: vi.fn(),
				setDownloadDir: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/"]}>
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route index element={<Home />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("聚合搜索")).toBeInTheDocument();
		});

		getDayMock.mockRestore();
	});
});
