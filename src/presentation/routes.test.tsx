import { act, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DIProvider } from "@/di/DIContext";
import { createDIContainerForTest } from "@/test/test-utils";
import { AppContextProvider } from "./context/AppContext";
import { routes } from "./routes";

describe("routes 路由懒加载与 PageLoader 覆盖", () => {
	it("应该能够成功切换和载入所有懒加载页面，并渲染 PageLoader", async () => {
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

		const mockContainer = createDIContainerForTest({
			bangumiRepository: {
				getCalendar: vi.fn().mockResolvedValue(mockCalendar),
				getSubject: vi.fn().mockResolvedValue({ id: 1, name: "Test Anime" }),
			},
			torrentRepository: {
				listTorrents: vi.fn().mockResolvedValue([]),
				getTorrentFiles: vi.fn().mockRejectedValue(new Error("Mock error")),
				getTorrentStatus: vi.fn().mockResolvedValue({}),
				getTorrentStreamUrl: vi.fn().mockResolvedValue(""),
				getSubtitleTracks: vi.fn().mockResolvedValue([]),
				subscribeTorrents: vi.fn().mockResolvedValue(() => {}),
			},
			settingsRepository: {
				getSettings: vi.fn().mockResolvedValue({ download_dir: "/mock" }),
			},
		});

		const router = createMemoryRouter(routes, {
			initialEntries: ["/"],
		});

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<RouterProvider router={router} />
				</AppContextProvider>
			</DIProvider>,
		);

		// 1. 验证 Home (同步加载)
		expect(screen.getByTestId("search-input")).toBeInTheDocument();

		// 2. 跳转到日历页 /calendar 并等待载入 (Lazy)
		await act(async () => {
			router.navigate("/calendar");
		});
		await waitFor(() => {
			expect(screen.getByText(/^一$|未找到新番数据/)).toBeInTheDocument();
		});

		// 3. 跳转到下载管理 /downloads 并等待载入 (Lazy)
		await act(async () => {
			router.navigate("/downloads");
		});
		await waitFor(() => {
			expect(screen.getByText(/暂无下载任务|正在加载/)).toBeInTheDocument();
		});

		// 4. 跳转到收藏页 /collections 并等待载入 (Lazy)
		await act(async () => {
			router.navigate("/collections");
		});
		await waitFor(() => {
			expect(screen.getByText(/我的收藏/)).toBeInTheDocument();
		});

		// 5. 跳转到设置页 /settings 并等待载入 (Lazy)
		await act(async () => {
			router.navigate("/settings");
		});
		await waitFor(() => {
			expect(
				screen.getByText(/默认下载及播放缓存目录|正在加载/),
			).toBeInTheDocument();
		});

		// 6. 跳转到种子详情 /torrent 并等待载入 (Lazy)
		await act(async () => {
			router.navigate("/torrent?infoHash=123");
		});
		await waitFor(() => {
			expect(screen.getByText(/种子解析失败|正在启动/)).toBeInTheDocument();
		});

		// 7. 跳转到番剧详情 /subject/1 并等待载入 (Lazy)
		await act(async () => {
			router.navigate("/subject/1");
		});
		await waitFor(() => {
			expect(screen.getByText(/返回日历|加载中/)).toBeInTheDocument();
		});

		// 8. 跳转到播放页 /play/1/1 并等待载入 (Lazy)
		await act(async () => {
			router.navigate("/play/1/1?title=Test");
		});
		await waitFor(() => {
			expect(screen.getByText(/下载进度:/)).toBeInTheDocument();
		});
	});
});
