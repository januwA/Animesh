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
import type {
	BangumiEpisode,
	BangumiSubject,
} from "@/domain/bangumi/BangumiSchemas";
import { createDIContainerForTest } from "@/test/test-utils";
import Layout from "../components/Layout";
import { AppContextProvider } from "../context/AppContext";
import SubjectDetail from "./SubjectDetail";

const currentLocation = {
	current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
	currentLocation.current = useLocation();
	return null;
};

describe("SubjectDetail 页面组件", () => {
	let mockContainer: DIContainer;

	beforeEach(() => {
		currentLocation.current = null;
		vi.clearAllMocks();
		vi.spyOn(window, "open").mockImplementation(() => null);
	});

	const renderSubjectDetail = (
		mockSubjectPromise: Promise<BangumiSubject>,
		mockEpisodesPromise: Promise<BangumiEpisode[]>,
		openerRepository?: any,
	) => {
		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(mockSubjectPromise),
				getEpisodes: vi.fn().mockReturnValue(mockEpisodesPromise),
			},
			openerRepository,
		});

		return render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/subject/123"]}>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route path="subject/:subjectId" element={<SubjectDetail />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);
	};

	it("当 API 正确返回数据时，应该展示动漫标题、信息、评分和剧集列表", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime Title",
			name_cn: "测试动漫标题",
			summary: "这是一个测试动漫的简介内容。",
			images: {
				large: "http://example.com/large.jpg",
				common: "http://example.com/common.jpg",
				medium: "http://example.com/medium.jpg",
				small: "http://example.com/small.jpg",
				grid: "http://example.com/grid.jpg",
			},
			rating: {
				score: 8.5,
				rank: 42,
				total: 1000,
			},
			collection: {
				wish: 100,
				collect: 500,
				doing: 200,
				on_hold: 50,
				dropped: 10,
			},
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		const mockEpisodes: BangumiEpisode[] = [
			{
				id: 1002,
				type: 1,
				sort: 2,
				name: "Second Ep",
				name_cn: "第二集 中文",
				duration: "24:00",
				airdate: "2026-07-02",
				desc: "第二集的简介内容",
			},
			{
				id: 1001,
				type: 0,
				sort: 1,
				name: "First Episode Jp",
				name_cn: "第一集 中文",
				duration: "24:00",
				airdate: "2026-07-01",
				desc: "第一集的简介内容",
			},
			{
				id: 1003,
				type: 2,
				sort: 3,
				name: "Third Ep",
				name_cn: "第三集 中文",
				duration: "24:00",
				airdate: "2026-07-03",
				desc: "",
			},
			{
				id: 1004,
				type: 3,
				sort: 4,
				name: "Fourth Ep",
				name_cn: "第四集 中文",
				duration: "24:00",
				airdate: "2026-07-04",
				desc: "",
			},
			{
				id: 1005,
				type: 4,
				sort: 5,
				name: "Fifth Ep",
				name_cn: "第五集 中文",
				duration: "24:00",
				airdate: "2026-07-05",
				desc: "",
			},
			{
				id: 1006,
				type: 5,
				sort: 6,
				name: "Sixth Ep",
				name_cn: "第六集 中文",
				duration: "24:00",
				airdate: "2026-07-06",
				desc: "",
			},
		];

		renderSubjectDetail(
			Promise.resolve(mockSubject),
			Promise.resolve(mockEpisodes),
		);

		await waitFor(() => {
			expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
		});

		expect(screen.getByText("Test Anime Title")).toBeInTheDocument();
		expect(
			screen.getByText("这是一个测试动漫的简介内容。"),
		).toBeInTheDocument();
		expect(screen.getByText("8.5")).toBeInTheDocument();
		expect(screen.getByText("Rank #42")).toBeInTheDocument();
		expect(screen.getByText("第一集 中文")).toBeInTheDocument();
		expect(screen.getByText("第二集 中文")).toBeInTheDocument();
	});

	it("点击剧集卡片时，应该跳转到主页并携带该剧集的搜索词", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime Title",
			name_cn: "测试动漫标题",
			summary: "简介",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 1000 },
			collection: {
				wish: 100,
				collect: 500,
				doing: 200,
				on_hold: 50,
				dropped: 10,
			},
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		const mockEpisodes: BangumiEpisode[] = [
			{
				id: 1001,
				type: 0,
				sort: 1,
				name: "First Episode Jp",
				name_cn: "第一集 中文",
				duration: "24:00",
				airdate: "2026-07-01",
				desc: "第一集简介",
			},
		];

		renderSubjectDetail(
			Promise.resolve(mockSubject),
			Promise.resolve(mockEpisodes),
		);

		await waitFor(() => {
			expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
		});

		const episodeCard = screen.getByText("第一集 中文").closest("button");
		expect(episodeCard).toBeInTheDocument();
		fireEvent.click(episodeCard!);

		expect(currentLocation.current?.pathname).toBe("/");
		expect(currentLocation.current?.search).toBe(
			`?keyword=${encodeURIComponent("测试动漫标题 01")}`,
		);
	});

	it("当 API 请求失败时，应该显示错误提示", async () => {
		renderSubjectDetail(
			Promise.reject(new Error("Subject API Error")),
			Promise.resolve([]),
		);

		await waitFor(() => {
			expect(
				screen.getByText("获取动漫详情失败", { exact: false }),
			).toBeInTheDocument();
		});
	});

	it("点击详情链接应该在浏览器中打开", async () => {
		const mockOpenUrl = vi.fn().mockResolvedValue(undefined);

		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime Title",
			name_cn: "测试动漫标题",
			summary: "简介",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 1000 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		renderSubjectDetail(Promise.resolve(mockSubject), Promise.resolve([]), {
			openUrl: mockOpenUrl,
		});

		await waitFor(() => {
			expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
		});

		const detailLink = screen.getByRole("link", { name: "详情" });
		fireEvent.click(detailLink);

		await waitFor(() => {
			expect(mockOpenUrl).toHaveBeenCalledWith("https://bgm.tv/subject/123");
		});
	});

	it("如果当前时间 >= ep.airdate，剧集卡片应该使用主色样式；否则使用普通样式", async () => {
		const today = new Date();
		const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
		const future = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

		const formatDate = (d: Date) => {
			const y = d.getFullYear();
			const m = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			return `${y}-${m}-${day}`;
		};

		const yesterdayStr = formatDate(yesterday);
		const futureStr = formatDate(future);

		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime Title",
			name_cn: "测试动漫标题",
			summary: "简介",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 1000 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		const mockEpisodes: BangumiEpisode[] = [
			{
				id: 1001,
				type: 0,
				sort: 1,
				name: "已播出剧集",
				name_cn: "已播出剧集",
				duration: "24:00",
				airdate: yesterdayStr,
				desc: "已播出",
			},
			{
				id: 1002,
				type: 0,
				sort: 2,
				name: "未播出剧集",
				name_cn: "未播出剧集",
				duration: "24:00",
				airdate: futureStr,
				desc: "未播出",
			},
		];

		renderSubjectDetail(
			Promise.resolve(mockSubject),
			Promise.resolve(mockEpisodes),
		);

		await waitFor(() => {
			expect(screen.getByText("已播出剧集")).toBeInTheDocument();
		});

		const airedCard = screen.getByText("已播出剧集").closest("button");
		const unairedCard = screen.getByText("未播出剧集").closest("button");

		expect(airedCard).toBeInTheDocument();
		expect(unairedCard).toBeInTheDocument();

		expect(airedCard!.className).toContain("bg-primary/5");
		expect(airedCard!.className).toContain("border-primary/20");

		expect(unairedCard!.className).toContain("bg-card");
		expect(unairedCard!.className).toContain("border-border");
	});

	it("点击返回日历按钮时，应该返回上一页", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime Title",
			name_cn: "测试动漫标题",
			summary: "简介",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 1000 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
				getEpisodes: vi.fn().mockReturnValue(Promise.resolve([])),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter
						initialEntries={["/calendar", "/subject/123"]}
						initialIndex={1}
					>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route path="calendar" element={<div>日历页面</div>} />
								<Route path="subject/:subjectId" element={<SubjectDetail />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
		});

		const backButton = screen.getByRole("button", { name: "返回日历" });
		fireEvent.click(backButton);

		await waitFor(() => {
			expect(currentLocation.current?.pathname).toBe("/calendar");
		});
	});

	it("当 API 返回的字段缺失时，页面应该正常渲染且不报错", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime Title",
			name_cn: "",
			summary: null,
			images: null,
			rating: null,
			collection: null,
			date: null,
			eps: null,
			platform: null,
		};

		renderSubjectDetail(Promise.resolve(mockSubject), Promise.resolve([]));

		await waitFor(() => {
			expect(screen.getByText("Test Anime Title")).toBeInTheDocument();
		});
	});

	it("加载数据时应该显示正在加载动漫详情提示", async () => {
		let resolveSubject: (value: BangumiSubject) => void = () => {};
		const subjectPromise = new Promise<BangumiSubject>((resolve) => {
			resolveSubject = resolve;
		});

		renderSubjectDetail(subjectPromise, Promise.resolve([]));

		expect(screen.getByText("正在加载动漫详情...")).toBeInTheDocument();

		// Resolve to prevent open promises warnings
		await act(async () => {
			resolveSubject({
				id: 123,
				name: "Anime",
				name_cn: "",
				summary: null,
				images: null,
				rating: null,
				collection: null,
				date: null,
				eps: null,
				platform: null,
			});
		});
	});

	it("当点击返回且支持视图过渡时，应该调用 startViewTransition 并返回上一页", async () => {
		const startViewTransitionMock = vi.fn((cb) => cb());
		document.startViewTransition = startViewTransitionMock as any;

		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime Title",
			name_cn: "测试动漫标题",
			summary: "简介",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 1000 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
				getEpisodes: vi.fn().mockReturnValue(Promise.resolve([])),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter
						initialEntries={["/calendar", "/subject/123"]}
						initialIndex={1}
					>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route path="calendar" element={<div>日历页面</div>} />
								<Route path="subject/:subjectId" element={<SubjectDetail />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
		});

		const backButton = screen.getByRole("button", { name: "返回日历" });
		fireEvent.click(backButton);

		expect(startViewTransitionMock).toHaveBeenCalled();
		await waitFor(() => {
			expect(currentLocation.current?.pathname).toBe("/calendar");
		});

		delete (document as any).startViewTransition;
	});

	it("进入页面处于加载状态时，如果路由 state 中含有数据，应该展示传递的数据", async () => {
		let resolveSubject: (value: BangumiSubject) => void = () => {};
		const subjectPromise = new Promise<BangumiSubject>((resolve) => {
			resolveSubject = resolve;
		});

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(subjectPromise),
				getEpisodes: vi.fn().mockReturnValue(Promise.resolve([])),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter
						initialEntries={[
							{
								pathname: "/subject/123",
								state: {
									name: "传递的动画名称",
									imageUrl: "http://example.com/passed-cover.jpg",
								},
							},
						]}
					>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route path="subject/:subjectId" element={<SubjectDetail />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		// 应该立即展示 state 中的名称和图片
		expect(screen.getByText("传递的动画名称")).toBeInTheDocument();
		const img = screen.getByRole("img", { name: "传递的动画名称" });
		expect(img).toBeInTheDocument();
		expect(img.getAttribute("src")).toBe("http://example.com/passed-cover.jpg");
		expect(screen.getByText("正在加载动漫详情...")).toBeInTheDocument();

		// 解决 Promise 以避免警告
		await act(async () => {
			resolveSubject({
				id: 123,
				name: "Anime",
				name_cn: "",
				summary: null,
				images: null,
				rating: null,
				collection: null,
				date: null,
				eps: null,
				platform: null,
			});
		});
	});

	it("应该对较长剧情简介展示展开/收起按钮并在点击时正确切换状态", async () => {
		// Mock scrollHeight and clientHeight to simulate overflow
		const spyScrollHeight = vi
			.spyOn(HTMLElement.prototype, "scrollHeight", "get")
			.mockImplementation(function (this: HTMLElement) {
				if (
					this.tagName === "P" &&
					this.textContent?.includes("这是一个很长很长的剧情简介")
				) {
					return 300;
				}
				return 0;
			});

		const spyClientHeight = vi
			.spyOn(HTMLElement.prototype, "clientHeight", "get")
			.mockImplementation(function (this: HTMLElement) {
				if (
					this.tagName === "P" &&
					this.textContent?.includes("这是一个很长很长的剧情简介")
				) {
					return 100;
				}
				return 0;
			});

		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime Title",
			name_cn: "测试动漫标题",
			summary:
				"这是一个很长很长的剧情简介，超出显示行数限制，需要展示折叠/展开按钮。",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 1000 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
				getEpisodes: vi.fn().mockReturnValue(Promise.resolve([])),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/subject/123"]}>
						<Routes>
							<Route path="subject/:subjectId" element={<SubjectDetail />} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		// Wait for rendering
		await waitFor(() => {
			expect(
				screen.getByText(/这是一个很长很长的剧情简介/),
			).toBeInTheDocument();
		});

		// "展开" button should be present
		const expandBtn = await screen.findByRole("button", { name: "展开" });
		expect(expandBtn).toBeInTheDocument();

		// Click "展开"
		fireEvent.click(expandBtn);

		// "收起" button should now be present
		const collapseBtn = await screen.findByRole("button", { name: "收起" });
		expect(collapseBtn).toBeInTheDocument();

		// Click "收起"
		fireEvent.click(collapseBtn);

		// Should show "展开" again
		expect(
			await screen.findByRole("button", { name: "展开" }),
		).toBeInTheDocument();

		spyScrollHeight.mockRestore();
		spyClientHeight.mockRestore();
	});

	it("应该能在缺少部分字段（如 platform、rating.total、ep.name_cn、ep.airdate）时正常降级渲染", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime Title",
			name_cn: "测试动漫标题",
			summary: "这是一个测试动漫的简介内容。",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: {
				score: 8.5,
				rank: 42,
				total: undefined as any, // test line 276 total fallback to 0
			},
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: undefined as any, // test line 218 missing platform
		};

		const mockEpisodes: BangumiEpisode[] = [
			{
				id: 1001,
				type: 0,
				sort: 1,
				name: "First Episode Jp Only",
				name_cn: undefined as any, // test line 442 fallback to ep.name
				duration: "24:00",
				airdate: undefined as any, // test line 407 airdate falsy
				desc: "第一集的简介内容",
			},
			{
				id: 1002,
				type: 0,
				sort: 2,
				name: "Future Episode",
				name_cn: "未来的一集",
				duration: "24:00",
				airdate: "2099-12-31", // test line 407 airdate in future
				desc: "第二集的简介内容",
			},
		];

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
				getEpisodes: vi.fn().mockReturnValue(Promise.resolve(mockEpisodes)),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/subject/123"]}>
						<Routes>
							<Route path="subject/:subjectId" element={<SubjectDetail />} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
		});

		// 1. Check platform Badge is not present
		expect(screen.queryByText("TV")).not.toBeInTheDocument();

		// 2. Check rating total fallback to 0
		expect(screen.getByText("0 人评分")).toBeInTheDocument();

		// 3. Check ep.name fallback for First Episode
		expect(screen.getByText("First Episode Jp Only")).toBeInTheDocument();

		// 4. Check future and undefined airdate styles / rendered classes
		expect(screen.getByText("未来的一集")).toBeInTheDocument();
	});

	it("当路由中没有 subjectId 时，应该什么都不加载直接返回", async () => {
		mockContainer = createDIContainerForTest({});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/subject"]}>
						<Routes>
							<Route path="subject" element={<SubjectDetail />} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		expect(screen.getByText("加载中...")).toBeInTheDocument();
	});

	it("在 API 数据加载成功前卸载组件，应该取消请求并不设置组件状态", async () => {
		let resolveSubject: any;
		const subjectPromise = new Promise<any>((resolve) => {
			resolveSubject = resolve;
		});

		let resolveEpisodes: any;
		const episodesPromise = new Promise<any>((resolve) => {
			resolveEpisodes = resolve;
		});

		const { unmount } = renderSubjectDetail(subjectPromise, episodesPromise);

		unmount();

		await act(async () => {
			resolveSubject({ id: 123, name: "Test" });
			resolveEpisodes([]);
		});
	});

	it("在 API 数据加载失败前卸载组件，应该取消请求并不设置错误信息", async () => {
		let rejectSubject: any;
		const subjectPromise = new Promise<any>((_, reject) => {
			rejectSubject = reject;
		});

		const episodesPromise = Promise.resolve([]);

		const { unmount } = renderSubjectDetail(subjectPromise, episodesPromise);

		unmount();

		await act(async () => {
			rejectSubject(new Error("Network Error"));
		});
	});

	it("当动漫和剧集均无中文名称时，点击剧集卡片应该使用原名进行搜索", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Original Anime Name",
			name_cn: "",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 100 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		const mockEpisodes: BangumiEpisode[] = [
			{
				id: 1001,
				type: 0,
				sort: 1,
				name: "Original Ep Name",
				name_cn: "",
				duration: "24:00",
				airdate: "2026-07-01",
				desc: "第一集的简介内容",
			},
		];

		renderSubjectDetail(
			Promise.resolve(mockSubject),
			Promise.resolve(mockEpisodes),
		);

		await waitFor(() => {
			expect(screen.getByText("Original Anime Name")).toBeInTheDocument();
		});

		const episodeCard = screen.getByText("Original Ep Name").closest("button");
		expect(episodeCard).toBeInTheDocument();
		fireEvent.click(episodeCard!);

		expect(currentLocation.current?.pathname).toBe("/");
		expect(currentLocation.current?.search).toBe(
			`?keyword=${encodeURIComponent("Original Anime Name 01")}`,
		);
	});
});

describe("SubjectDetail 页面 - 角色和制作人员", () => {
	let mockContainer: DIContainer;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(window, "open").mockImplementation(() => null);
	});

	it("数据加载完成后应该展示角色卡片区域", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime",
			name_cn: "测试动漫",
			summary: "简介",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 100 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		const mockCharacters = [
			{
				images: {
					small: "https://example.com/small.jpg",
					grid: "https://example.com/grid.jpg",
					large: "https://example.com/large.jpg",
					medium: "https://example.com/medium.jpg",
				},
				name: "ヤニねこ",
				summary: "主角猫",
				relation: "主角",
				type: 1,
				id: 174916,
				actors: [
					{
						images: {
							small: "https://example.com/small.jpg",
							grid: "https://example.com/grid.jpg",
							large: "https://example.com/large.jpg",
							medium: "https://example.com/medium.jpg",
						},
						name: "夏吉ゆうこ",
						short_summary: "声优",
						career: ["seiyu"],
						id: 36024,
						type: 1,
						locked: false,
					},
				],
			},
		];

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
				getEpisodes: vi.fn().mockReturnValue(Promise.resolve([])),
				getSubjectCharacters: vi
					.fn()
					.mockReturnValue(Promise.resolve(mockCharacters)),
				getSubjectPersons: vi.fn().mockReturnValue(Promise.resolve([])),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/subject/123"]}>
						<Routes>
							<Route path="subject/:subjectId" element={<SubjectDetail />} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("测试动漫")).toBeInTheDocument();
		});

		// Characters section should be rendered
		expect(screen.getByText("角色")).toBeInTheDocument();
		expect(screen.getByText("ヤニねこ")).toBeInTheDocument();
		expect(screen.getByText("CV: 夏吉ゆうこ")).toBeInTheDocument();
	});

	it("数据加载完成后应该展示制作人员区域", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime",
			name_cn: "测试动漫",
			summary: "简介",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 100 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		const mockPersons = [
			{
				images: {
					small: "https://example.com/small.jpg",
					grid: "https://example.com/grid.jpg",
					large: "https://example.com/large.jpg",
					medium: "https://example.com/medium.jpg",
				},
				name: "木村拓",
				relation: "导演",
				career: ["producer"],
				type: 1,
				id: 44615,
				eps: "",
			},
			{
				images: {
					small: "",
					grid: "",
					large: "",
					medium: "",
				},
				name: "あおしまたかし",
				relation: "脚本",
				career: ["producer"],
				type: 1,
				id: 2639,
				eps: "3",
			},
		];

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
				getEpisodes: vi.fn().mockReturnValue(Promise.resolve([])),
				getSubjectCharacters: vi.fn().mockReturnValue(Promise.resolve([])),
				getSubjectPersons: vi
					.fn()
					.mockReturnValue(Promise.resolve(mockPersons)),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/subject/123"]}>
						<Routes>
							<Route path="subject/:subjectId" element={<SubjectDetail />} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("测试动漫")).toBeInTheDocument();
		});

		// Staff section should be rendered
		expect(screen.getByText("制作人员")).toBeInTheDocument();
		expect(screen.getByText("木村拓")).toBeInTheDocument();
		expect(screen.getByText("あおしまたかし")).toBeInTheDocument();
		// Relation header should be visible
		expect(screen.getByText("导演")).toBeInTheDocument();
		expect(screen.getByText("脚本")).toBeInTheDocument();
	});

	it("角色区域数据为空时应该展示空状态提示", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime",
			name_cn: "测试动漫",
			summary: "简介",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 100 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
				getEpisodes: vi.fn().mockReturnValue(Promise.resolve([])),
				getSubjectCharacters: vi.fn().mockReturnValue(Promise.resolve([])),
				getSubjectPersons: vi.fn().mockReturnValue(Promise.resolve([])),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/subject/123"]}>
						<Routes>
							<Route path="subject/:subjectId" element={<SubjectDetail />} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("测试动漫")).toBeInTheDocument();
		});

		expect(screen.getByText("暂无角色数据")).toBeInTheDocument();
		expect(screen.getByText("暂无制作人员数据")).toBeInTheDocument();
	});

	it("在角色和制作人员数据加载中时应该显示骨架屏", async () => {
		let resolveSubject: (value: BangumiSubject) => void = () => {};
		const subjectPromise = new Promise<BangumiSubject>((resolve) => {
			resolveSubject = resolve;
		});

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(subjectPromise),
				getEpisodes: vi.fn().mockReturnValue(new Promise(() => {})),
				getSubjectCharacters: vi.fn().mockReturnValue(new Promise(() => {})),
				getSubjectPersons: vi.fn().mockReturnValue(new Promise(() => {})),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/subject/123"]}>
						<Routes>
							<Route path="subject/:subjectId" element={<SubjectDetail />} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		// The sections should exist with skeleton loading indicators
		expect(screen.getByText("角色")).toBeInTheDocument();
		expect(screen.getByText("制作人员")).toBeInTheDocument();

		// Resolve to clean up
		await act(async () => {
			resolveSubject({
				id: 123,
				name: "Anime",
				name_cn: "",
				summary: null,
				images: null,
				rating: null,
				collection: null,
				date: null,
				eps: null,
				platform: null,
			});
		});
	});

	it("同一个人相同制作角色出现多次时应正确去重", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime",
			name_cn: "测试动漫",
			summary: "简介",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 100 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		const mockPersons = [
			{
				images: { small: "", grid: "", large: "", medium: "" },
				name: "木村拓",
				relation: "导演",
				career: ["producer"],
				type: 1,
				id: 44615,
				eps: "",
			},
			{
				images: { small: "", grid: "", large: "", medium: "" },
				name: "木村拓",
				relation: "导演",
				career: ["producer"],
				type: 1,
				id: 44615,
				eps: "",
			},
			{
				images: { small: "", grid: "", large: "", medium: "" },
				name: "木村拓",
				relation: "脚本",
				career: ["producer"],
				type: 1,
				id: 44615,
				eps: "1-3",
			},
		];

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
				getEpisodes: vi.fn().mockReturnValue(Promise.resolve([])),
				getSubjectCharacters: vi.fn().mockReturnValue(Promise.resolve([])),
				getSubjectPersons: vi
					.fn()
					.mockReturnValue(Promise.resolve(mockPersons)),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/subject/123"]}>
						<Routes>
							<Route path="subject/:subjectId" element={<SubjectDetail />} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("测试动漫")).toBeInTheDocument();
		});

		expect(screen.getByText("导演")).toBeInTheDocument();
		expect(screen.getByText("脚本")).toBeInTheDocument();
	});

	it("角色使用 medium 图片降级且有多名声优时应该正常显示", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime",
			name_cn: "测试动漫",
			summary: "简介",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 100 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		const mockCharacters = [
			{
				images: {
					small: "",
					grid: "",
					large: "",
					medium: "http://example.com/medium.jpg",
				},
				name: "ヤニねこ",
				summary: "主角猫",
				relation: "配角",
				type: 1,
				id: 174916,
				actors: [
					{
						images: { small: "", grid: "", large: "", medium: "" },
						name: "声優A",
						short_summary: "",
						career: ["seiyu"],
						id: 1,
						type: 1,
						locked: false,
					},
					{
						images: { small: "", grid: "", large: "", medium: "" },
						name: "声優B",
						short_summary: "",
						career: ["seiyu"],
						id: 2,
						type: 1,
						locked: false,
					},
				],
			},
		];

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
				getEpisodes: vi.fn().mockReturnValue(Promise.resolve([])),
				getSubjectCharacters: vi
					.fn()
					.mockReturnValue(Promise.resolve(mockCharacters)),
				getSubjectPersons: vi.fn().mockReturnValue(Promise.resolve([])),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/subject/123"]}>
						<Routes>
							<Route path="subject/:subjectId" element={<SubjectDetail />} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("测试动漫")).toBeInTheDocument();
		});

		expect(screen.getByText("+1 位声优")).toBeInTheDocument();
		expect(screen.getByText("CV: 声優A")).toBeInTheDocument();
	});

	it("角色图片完全为空时应正常显示占位符", async () => {
		const mockSubject: BangumiSubject = {
			id: 123,
			name: "Test Anime",
			name_cn: "测试动漫",
			summary: "简介",
			images: {
				large: "http://example.com/large.jpg",
				common: "",
				medium: "",
				small: "",
				grid: "",
			},
			rating: { score: 8.5, rank: 42, total: 100 },
			collection: { doing: 200 },
			date: "2026-07-01",
			eps: 12,
			platform: "TV",
		};

		const mockCharacters = [
			{
				images: { small: "", grid: "", large: "", medium: "" },
				name: "ノーイメージ",
				summary: "",
				relation: "配角",
				type: 1,
				id: 99991,
				actors: [],
			},
		];

		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
				getEpisodes: vi.fn().mockReturnValue(Promise.resolve([])),
				getSubjectCharacters: vi
					.fn()
					.mockReturnValue(Promise.resolve(mockCharacters)),
				getSubjectPersons: vi.fn().mockReturnValue(Promise.resolve([])),
			},
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/subject/123"]}>
						<Routes>
							<Route path="subject/:subjectId" element={<SubjectDetail />} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("测试动漫")).toBeInTheDocument();
		});

		expect(screen.getByText("ノーイメージ")).toBeInTheDocument();
	});
});
