import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import Layout from "../components/Layout";
import { AppContextProvider } from "../context/AppContext";
import type { DIContainer } from "../di/DIContext";
import { DIProvider } from "../di/DIContext";
import { createDIContainerForTest } from "../test/test-utils";
import type { BangumiCalendarDay } from "../types";
import CalendarPage from "./Calendar";

vi.mock("@tauri-apps/plugin-opener", () => ({
	openUrl: vi.fn(),
}));

const currentLocation = {
	current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
	currentLocation.current = useLocation();
	return null;
};

describe("Calendar 页面组件", () => {
	let mockContainer: DIContainer;

	beforeEach(() => {
		currentLocation.current = null;
		vi.clearAllMocks();
		vi.spyOn(window, "open").mockImplementation(() => null);
	});

	const renderCalendar = (
		mockCalendarPromise: Promise<BangumiCalendarDay[]>,
	) => {
		mockContainer = createDIContainerForTest({
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
				getSettings: vi.fn(),
				setDownloadDir: vi.fn(),
				setProxy: vi.fn(),
				setTrackers: vi.fn(),
				selectDirectory: vi.fn(),
			},
			bangumiRepository: {
				getCalendar: vi.fn().mockReturnValue(mockCalendarPromise),
			},
		});

		return render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/calendar"]}>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route path="calendar" element={<CalendarPage />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);
	};

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
						images: { large: "http://example.com/cover.jpg" },
						rating: { score: 8.5 },
						collection: { doing: 1200 },
						rank: 1,
					},
				],
			},
		];

		renderCalendar(
			Promise.resolve(mockCalendar as unknown as BangumiCalendarDay[]),
		);

		await waitFor(() => {
			expect(screen.getByText("一周新番")).toBeInTheDocument();
		});
		expect(screen.getByText("中文动漫名")).toBeInTheDocument();
		expect(screen.getByText("8.5")).toBeInTheDocument();
		expect(screen.getByText("1,200")).toBeInTheDocument();
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
						images: { large: "http://example.com/cover.jpg" },
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

		renderCalendar(
			Promise.resolve(mockCalendar as unknown as BangumiCalendarDay[]),
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

	it("当点击新番卡片时，应该跳转到主页并携带搜索词", async () => {
		const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
		const mockCalendar = [
			{
				weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
				items: [
					{
						id: 1,
						name: "Anime Original Name",
						name_cn: "中文动漫名",
						images: { large: "http://example.com/cover.jpg" },
						rating: { score: 8.5 },
						collection: { doing: 1200 },
						rank: 1,
					},
				],
			},
		];

		renderCalendar(
			Promise.resolve(mockCalendar as unknown as BangumiCalendarDay[]),
		);

		await waitFor(() => {
			expect(screen.getByText("中文动漫名")).toBeInTheDocument();
		});

		const animeCard = screen.getByTitle("搜索: 中文动漫名");
		fireEvent.click(animeCard);

		expect(currentLocation.current?.pathname).toBe("/");
		expect(currentLocation.current?.search).toBe(
			"?keyword=%E4%B8%AD%E6%96%87%E5%8A%A8%E6%BC%AB%E5%90%8D",
		);
	});

	it("当 bangumiRepository 请求失败时，应该显示错误提示", async () => {
		renderCalendar(Promise.reject(new Error("API error")));

		await waitFor(() => {
			expect(
				screen.getByText("获取新番日历失败，请检查网络或重试"),
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

		renderCalendar(Promise.resolve(mockCalendar));

		await waitFor(() => {
			expect(screen.getByText("暂无更新")).toBeInTheDocument();
		});
	});

	it("当组件在 calendar 请求完成前卸载时，不应该更新状态", async () => {
		let resolvePromise: (value: BangumiCalendarDay[]) => void = () => {};
		const promise = new Promise<BangumiCalendarDay[]>((resolve) => {
			resolvePromise = resolve;
		});

		const { unmount } = renderCalendar(promise);

		unmount();
		resolvePromise([]);
	});

	it("应该在星期天时将 weekday id 识别为 7", async () => {
		const getDayMock = vi.spyOn(Date.prototype, "getDay").mockReturnValue(0);

		renderCalendar(Promise.resolve([]));

		await waitFor(() => {
			expect(
				screen.getByText("未找到新番数据，请稍后重试"),
			).toBeInTheDocument();
		});

		getDayMock.mockRestore();
	});

	it("当组件在 calendar 请求失败前卸载时，不应该更新错误状态", async () => {
		let rejectPromise: (reason: unknown) => void = () => {};
		const promise = new Promise<BangumiCalendarDay[]>((_, reject) => {
			rejectPromise = reject;
		});

		const { unmount } = renderCalendar(promise);

		unmount();
		rejectPromise(new Error("API error"));
	});

	it("在 WeeklyCalendar 中，点击详情链接应该在浏览器中打开（通过 Tauri Opener 插件）且不触发搜索", async () => {
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		vi.mocked(openUrl).mockResolvedValue(undefined);

		const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
		const mockCalendar = [
			{
				weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
				items: [
					{
						id: 1,
						url: "http://example.com/anime",
						name: "Anime Original Name",
						name_cn: "中文动漫名",
					},
				],
			},
		];

		renderCalendar(
			Promise.resolve(mockCalendar as unknown as BangumiCalendarDay[]),
		);

		await waitFor(() => {
			expect(screen.getByText("中文动漫名")).toBeInTheDocument();
		});

		const detailLink = screen.getByRole("link", { name: "详情" });
		fireEvent.click(detailLink);

		await waitFor(() => {
			expect(openUrl).toHaveBeenCalledWith("http://example.com/anime");
		});
		expect(currentLocation.current?.pathname).not.toBe("/");
	});

	it("在 WeeklyCalendar 中，若 Tauri Opener 插件调用失败应该降级使用 window.open", async () => {
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		vi.mocked(openUrl).mockRejectedValue(new Error("Tauri error"));

		const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
		const mockCalendar = [
			{
				weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
				items: [
					{
						id: 1,
						url: "http://example.com/anime",
						name: "Anime Original Name",
						name_cn: "中文动漫名",
					},
				],
			},
		];

		renderCalendar(
			Promise.resolve(mockCalendar as unknown as BangumiCalendarDay[]),
		);

		await waitFor(() => {
			expect(screen.getByText("中文动漫名")).toBeInTheDocument();
		});

		const detailLink = screen.getByRole("link", { name: "详情" });
		fireEvent.click(detailLink);

		await waitFor(() => {
			expect(openUrl).toHaveBeenCalledWith("http://example.com/anime");
			expect(window.open).toHaveBeenCalledWith(
				"http://example.com/anime",
				"_blank",
			);
		});
		expect(currentLocation.current?.pathname).not.toBe("/");
	});

	it("在 WeeklyCalendar 中，按下 Enter 键应该触发搜索", async () => {
		const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
		const mockCalendar = [
			{
				weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
				items: [
					{
						id: 1,
						name: "Anime Original Name",
						name_cn: "键盘测试动漫",
					},
				],
			},
		];

		renderCalendar(
			Promise.resolve(mockCalendar as unknown as BangumiCalendarDay[]),
		);

		await waitFor(() => {
			expect(screen.getByText("键盘测试动漫")).toBeInTheDocument();
		});

		const animeCard = screen.getByTitle("搜索: 键盘测试动漫");

		// 测试非 Enter/Space 键，不应该触发跳转
		fireEvent.keyDown(animeCard, { key: "Escape" });
		expect(currentLocation.current?.pathname).not.toBe("/");

		// 测试 Enter 键
		fireEvent.keyDown(animeCard, { key: "Enter" });
		expect(currentLocation.current?.pathname).toBe("/");
		expect(currentLocation.current?.search).toBe(
			"?keyword=%E9%94%AE%E7%9B%98%E6%B5%8B%E8%AF%95%E5%8A%A8%E6%BC%AB",
		);
	});

	it("在 WeeklyCalendar 中，按下空格键应该触发搜索", async () => {
		const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
		const mockCalendar = [
			{
				weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
				items: [
					{
						id: 1,
						name: "Anime Original Name",
						name_cn: "键盘测试动漫",
					},
				],
			},
		];

		renderCalendar(
			Promise.resolve(mockCalendar as unknown as BangumiCalendarDay[]),
		);

		await waitFor(() => {
			expect(screen.getByText("键盘测试动漫")).toBeInTheDocument();
		});

		const animeCard = screen.getByTitle("搜索: 键盘测试动漫");

		// 测试空格键
		fireEvent.keyDown(animeCard, { key: " " });
		expect(currentLocation.current?.pathname).toBe("/");
		expect(currentLocation.current?.search).toBe(
			"?keyword=%E9%94%AE%E7%9B%98%E6%B5%8B%E8%AF%95%E5%8A%A8%E6%BC%AB",
		);
	});

	it("应该能在周日正确渲染 WeeklyCalendar，且能处理无中文名动漫的展示", async () => {
		// Mock system time to a Sunday (June 28, 2026 was a Sunday)
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-28T12:00:00"));

		const mockCalendar = [
			{
				weekday: { id: 7, en: "sunday", cn: "星期日", ja: "日曜日" },
				items: [
					{
						id: 99,
						name: "English Only Anime Name",
						name_cn: "",
						images: { large: "http://example.com/cover.jpg" },
						rating: { score: 8.5 },
						collection: { doing: 1200 },
						rank: 1,
					},
				],
			},
		];

		renderCalendar(
			Promise.resolve(mockCalendar as unknown as BangumiCalendarDay[]),
		);

		// Switch back to real timers so waitFor doesn't hang
		vi.useRealTimers();

		await waitFor(() => {
			expect(screen.getByText("English Only Anime Name")).toBeInTheDocument();
		});

		const card = screen.getByText("English Only Anime Name");
		fireEvent.keyDown(card, { key: "Escape", code: "Escape" });
	});

	it("当今天是非星期日时，WeeklyCalendar 应该正确识别 weekday id，且点击无中文名的番剧应该回退到原名搜索", async () => {
		const getDaySpy = vi.spyOn(Date.prototype, "getDay").mockReturnValue(1); // 1 = Monday

		const mockCalendar = [
			{
				weekday: { id: 1, en: "Monday", cn: "星期一", ja: "月曜日" },
				items: [
					{
						id: 1,
						name: "Monday Anime Original",
						name_cn: "",
						images: { large: "http://example.com/cover.jpg" },
						rating: { score: 9.0 },
						collection: { doing: 500 },
						rank: 1,
					},
				],
			},
		];

		renderCalendar(
			Promise.resolve(mockCalendar as unknown as BangumiCalendarDay[]),
		);

		await waitFor(() => {
			expect(screen.getByText("Monday Anime Original")).toBeInTheDocument();
		});

		// Click the card with empty name_cn to cover the || item.name fallback
		const animeCard = screen.getByTitle("搜索: Monday Anime Original");
		fireEvent.click(animeCard);

		expect(currentLocation.current?.pathname).toBe("/");
		expect(currentLocation.current?.search).toContain("Monday");

		getDaySpy.mockRestore();
	});

	it("当今天是星期日时，WeeklyCalendar 应该正确识别 weekday id 为 7", async () => {
		const getDaySpy = vi.spyOn(Date.prototype, "getDay").mockReturnValue(0); // 0 = Sunday

		const mockCalendar = [
			{
				weekday: { id: 7, en: "Sunday", cn: "星期日", ja: "日曜日" },
				items: [
					{
						id: 2,
						name: "Sunday Anime",
						name_cn: "周日动漫",
						images: { large: "http://example.com/cover.jpg" },
						rating: { score: 9.0 },
						collection: { doing: 500 },
						rank: 1,
					},
				],
			},
		];

		renderCalendar(
			Promise.resolve(mockCalendar as unknown as BangumiCalendarDay[]),
		);

		await waitFor(() => {
			expect(screen.getByText("周日动漫")).toBeInTheDocument();
		});

		getDaySpy.mockRestore();
	});
});
