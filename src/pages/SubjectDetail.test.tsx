import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import type {
	BangumiEpisode,
	BangumiSubject,
} from "@/domain/bangumi/BangumiSchemas";
import Layout from "../components/Layout";
import { AppContextProvider } from "../context/AppContext";
import type { DIContainer } from "../di/DIContext";
import { DIProvider } from "../di/DIContext";
import { createDIContainerForTest } from "../test/test-utils";
import SubjectDetail from "./SubjectDetail";

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
	) => {
		mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue([]),
				getSubject: vi.fn().mockReturnValue(mockSubjectPromise),
				getEpisodes: vi.fn().mockReturnValue(mockEpisodesPromise),
			},
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
				id: 1001,
				type: 0,
				sort: 1,
				name: "First Episode Jp",
				name_cn: "第一集 中文",
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
			expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
		});

		expect(screen.getByText("Test Anime Title")).toBeInTheDocument();
		expect(
			screen.getByText("这是一个测试动漫的简介内容。"),
		).toBeInTheDocument();
		expect(screen.getByText("8.5")).toBeInTheDocument();
		expect(screen.getByText("Rank #42")).toBeInTheDocument();
		expect(screen.getByText("第一集 中文")).toBeInTheDocument();
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

	it("点击详情链接应该在浏览器中打开（通过 Tauri Opener 插件）", async () => {
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		vi.mocked(openUrl).mockResolvedValue(undefined);

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

		renderSubjectDetail(Promise.resolve(mockSubject), Promise.resolve([]));

		await waitFor(() => {
			expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
		});

		const detailLink = screen.getByRole("link", { name: "详情" });
		fireEvent.click(detailLink);

		await waitFor(() => {
			expect(openUrl).toHaveBeenCalledWith("https://bgm.tv/subject/123");
		});
	});

	it("若 Tauri Opener 插件调用失败应该降级使用 window.open", async () => {
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		vi.mocked(openUrl).mockRejectedValue(new Error("Tauri error"));

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

		renderSubjectDetail(Promise.resolve(mockSubject), Promise.resolve([]));

		await waitFor(() => {
			expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
		});

		const detailLink = screen.getByRole("link", { name: "详情" });
		fireEvent.click(detailLink);

		await waitFor(() => {
			expect(openUrl).toHaveBeenCalledWith("https://bgm.tv/subject/123");
			expect(window.open).toHaveBeenCalledWith(
				"https://bgm.tv/subject/123",
				"_blank",
			);
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

		expect(unairedCard!.className).toContain("bg-card/30");
		expect(unairedCard!.className).toContain("border-white/5");
	});
});
