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
import Home from "./Home";

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
	value: {
		writeText: vi.fn(),
	},
	writable: true,
});

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("@/presentation/components/ui/select", () => {
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
		SelectTrigger: () => null,
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
		localStorage.clear();
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
			subscribeTorrents: vi.fn().mockResolvedValue(() => {}),
		};

		mockContainer = createDIContainerForTest({
			torrentRepository: mockTorrentRepository,
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
		expect(screen.getByTestId("search-input")).toBeInTheDocument();
		expect(screen.getByText("聚合搜索")).toBeInTheDocument();
	});

	it("应该在组件挂载时读取 URL 的 keyword 参数并自动触发搜索", async () => {
		const mockResults = [
			{
				title: "xxx 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];
		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);

		renderHome("/?keyword=xxx");

		await waitFor(() => {
			expect(screen.getByText("xxx 第1集")).toBeInTheDocument();
		});
		expect(mockTorrentRepository.search).toHaveBeenCalledWith(
			expect.any(Object),
			"xxx",
			"dmhy",
		);
	});

	it("当输入关键词并搜索成功时，应该显示结果", async () => {
		const mockResults = [
			{
				title: "xxx 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];

		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);

		renderHome();

		const input = screen.getByPlaceholderText("输入动漫名称");

		fireEvent.change(input, { target: { value: "xxx" } });
		fireEvent.submit(input.closest("form")!);

		expect(screen.getByText(/正在获取资源列表/)).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText("xxx 第1集")).toBeInTheDocument();
		});

		expect(document.querySelector(".results-count")?.textContent?.trim()).toBe(
			"找到 1 个资源",
		);
		expect(mockTorrentRepository.search).toHaveBeenCalledWith(
			expect.any(Object),
			"xxx",
			"dmhy",
		);
	});

	it("当搜索返回空/undefined结果时，应该降级使用空数组并显示无资源提示", async () => {
		vi.mocked(mockTorrentRepository.search).mockResolvedValue([]);

		renderHome();

		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "xxx" } });
		fireEvent.submit(input.closest("form")!);

		await waitFor(() => {
			expect(
				screen.getByText("未找到相关资源，请换个关键词试试"),
			).toBeInTheDocument();
		});
	});

	it("当输入空白关键词并提交时，不应该触发搜索", async () => {
		renderHome();

		const input = screen.getByPlaceholderText("输入动漫名称"),
			button = screen.getByRole("button", { name: "搜索" });

		fireEvent.change(input, { target: { value: "   " } });
		fireEvent.click(button);

		expect(mockTorrentRepository.search).not.toHaveBeenCalled();
	});

	it("当搜索失败时，应该显示错误提示", async () => {
		vi.mocked(mockTorrentRepository.search).mockRejectedValue("网络请求超时");

		renderHome();

		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "xxx" } });
		fireEvent.submit(input.closest("form")!);

		await waitFor(() => {
			expect(
				screen.getByText("网络请求超时", { exact: false }),
			).toBeInTheDocument();
		});
	});

	it("当搜索抛出非字符串错误时，应该显示默认错误提示", async () => {
		vi.mocked(mockTorrentRepository.search).mockRejectedValueOnce(
			new Error("Internal Server Error"),
		);

		renderHome();

		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "xxx" } });
		fireEvent.submit(input.closest("form")!);

		await waitFor(() => {
			expect(
				screen.getByText("搜索失败，请检查网络或重试", { exact: false }),
			).toBeInTheDocument();
		});
	});

	it("当点击复制磁力按钮成功时，应该显示Toast提示", async () => {
		const mockResults = [
			{
				title: "xxx 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];
		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);

		renderHome();

		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "xxx" } });
		fireEvent.submit(input.closest("form")!);

		await waitFor(() => {
			expect(screen.getByText("xxx 第1集")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		const copyBtn = screen.getByRole("button", { name: "复制磁力" });
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
				title: "xxx 第1集",
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

		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "xxx" } });
		fireEvent.submit(input.closest("form")!);

		await waitFor(() => {
			expect(screen.getByText("xxx 第1集")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		const copyBtn = screen.getByRole("button", { name: "复制磁力" });
		fireEvent.click(copyBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getByText("复制失败，请手动复制")).toBeInTheDocument();
	});

	it("当点击边下边播时，应该跳转", async () => {
		const mockResults = [
			{
				title: "xxx 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		];
		vi.mocked(mockTorrentRepository.search).mockResolvedValue(mockResults);

		renderHome();

		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "xxx" } });
		fireEvent.submit(input.closest("form")!);

		await waitFor(() => {
			expect(screen.getByText("xxx 第1集")).toBeInTheDocument();
		});

		vi.useFakeTimers();

		const playBtn = screen.getByRole("button", { name: "边下边播" });
		fireEvent.click(playBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		expect(currentLocation.current?.pathname).toBe("/torrent");
		expect(currentLocation.current?.search).toContain("magnet=");
		expect(currentLocation.current?.search).toContain("title=");
	});

	it("当挂载时从 URL 读取 keyword 触发的搜索失败（字符串错误）时，应该显示错误提示", async () => {
		vi.mocked(mockTorrentRepository.search).mockRejectedValue("网络请求超时");

		renderHome("/?keyword=xxx");

		await waitFor(() => {
			expect(
				screen.getByText("网络请求超时", { exact: false }),
			).toBeInTheDocument();
		});
	});

	it("当挂载时从 URL 读取 keyword 触发的搜索失败（非字符串错误）时，应该显示默认错误提示", async () => {
		vi.mocked(mockTorrentRepository.search).mockRejectedValue(
			new Error("error"),
		);

		renderHome("/?keyword=xxx");

		await waitFor(() => {
			expect(
				screen.getByText("搜索失败，请检查网络或重试", { exact: false }),
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

		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "xxx" } });

		const select = screen.getByRole("combobox");
		fireEvent.change(select, { target: { value: "bangumi_moe" } });

		fireEvent.submit(input.closest("form")!);

		await waitFor(() => {
			expect(mockTorrentRepository.search).toHaveBeenCalledWith(
				expect.any(Object),
				"xxx",
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

		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "xxx" } });

		const select = screen.getByRole("combobox");
		fireEvent.change(select, { target: { value: "mikan" } });

		fireEvent.submit(input.closest("form")!);

		await waitFor(() => {
			expect(mockTorrentRepository.search).toHaveBeenCalledWith(
				expect.any(Object),
				"xxx",
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

		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "xxx" } });

		const select = screen.getByRole("combobox");
		fireEvent.change(select, { target: { value: "nyaa" } });

		fireEvent.submit(input.closest("form")!);

		await waitFor(() => {
			expect(mockTorrentRepository.search).toHaveBeenCalledWith(
				expect.any(Object),
				"xxx",
				"nyaa",
			);
			expect(screen.getByText("Nyaa资源 1")).toBeInTheDocument();
		});
	});

	it("应该在组件挂载时读取 URL 的 keyword 参数，当搜索返回空/undefined结果时，应该降级使用空数组并显示无资源提示", async () => {
		vi.mocked(mockTorrentRepository.search).mockResolvedValue([]);

		renderHome("/?keyword=xxx");

		await waitFor(() => {
			expect(
				screen.getByText("未找到相关资源，请换个关键词试试"),
			).toBeInTheDocument();
		});
	});

	it("当 URL keyword 参数为纯空白时，不应该触发搜索", () => {
		renderHome("/?keyword=%20%20");

		expect(mockTorrentRepository.search).not.toHaveBeenCalled();
	});

	it("当点击取消搜索按钮时，应该发起取消请求，并清空加载状态不显示错误", async () => {
		let rejectSearch: any;
		let isCancelled = false;
		const searchPromise = new Promise<any>((_, reject) => {
			rejectSearch = reject;
		});
		vi.mocked(mockTorrentRepository.search).mockImplementation((ctx) => {
			ctx.done().then(() => {
				isCancelled = true;
			});
			return searchPromise;
		});

		renderHome();

		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "xxx" } });
		fireEvent.submit(input.closest("form")!);

		expect(screen.getByText(/正在获取资源列表/)).toBeInTheDocument();
		const cancelBtn = screen.getByRole("button", { name: "取消搜索" });
		expect(cancelBtn).toBeInTheDocument();

		fireEvent.click(cancelBtn);

		await waitFor(() => {
			expect(isCancelled).toBe(true);
		});

		await act(async () => {
			rejectSearch(new Error("Search cancelled"));
		});

		await waitFor(() => {
			expect(screen.queryByText(/正在获取资源列表/)).not.toBeInTheDocument();
		});

		expect(screen.queryByText(/搜索失败/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Search cancelled/)).not.toBeInTheDocument();
	});

	it("当组件卸载时，应该自动触发搜索的取消请求", async () => {
		let isCancelled = false;
		const searchPromise = new Promise<any>(() => {});
		vi.mocked(mockTorrentRepository.search).mockImplementation((ctx) => {
			ctx.done().then(() => {
				isCancelled = true;
			});
			return searchPromise;
		});

		const { unmount } = renderHome();

		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "xxx" } });
		fireEvent.submit(input.closest("form")!);

		expect(screen.getByText(/正在获取资源列表/)).toBeInTheDocument();

		unmount();

		await waitFor(() => {
			expect(isCancelled).toBe(true);
		});
	});

	it("应该从 localStorage 初始化并渲染历史搜索记录", () => {
		localStorage.setItem(
			"animesh_search_history",
			JSON.stringify(["xxx", "柯南"]),
		);
		renderHome();
		expect(screen.getByText("最近搜索:")).toBeInTheDocument();
		expect(screen.getByText("xxx")).toBeInTheDocument();
		expect(screen.getByText("柯南")).toBeInTheDocument();
	});

	it("应该在执行搜索时将关键词加入历史记录（去重、置顶，不限数量）", async () => {
		vi.mocked(mockTorrentRepository.search).mockResolvedValue([]);

		renderHome();
		const input = screen.getByPlaceholderText("输入动漫名称");

		// 1. 搜索 "xxx"
		fireEvent.change(input, { target: { value: "xxx" } });
		fireEvent.submit(input.closest("form")!);
		await waitFor(() => {
			expect(screen.getByText("最近搜索:")).toBeInTheDocument();
		});
		expect(screen.getByText("xxx")).toBeInTheDocument();
		expect(
			JSON.parse(localStorage.getItem("animesh_search_history") || "[]"),
		).toEqual(["xxx"]);

		// 2. 搜索 "柯南"
		fireEvent.change(input, { target: { value: "柯南" } });
		fireEvent.submit(input.closest("form")!);
		await waitFor(() => {
			expect(screen.getByText("柯南")).toBeInTheDocument();
		});
		expect(
			JSON.parse(localStorage.getItem("animesh_search_history") || "[]"),
		).toEqual(["柯南", "xxx"]);

		// 3. 再次搜索 "xxx" (置顶)
		fireEvent.change(input, { target: { value: "xxx" } });
		fireEvent.submit(input.closest("form")!);
		await waitFor(() => {
			expect(screen.getByText("xxx")).toBeInTheDocument();
		});
		expect(
			JSON.parse(localStorage.getItem("animesh_search_history") || "[]"),
		).toEqual(["xxx", "柯南"]);

		// 4. 连续搜索超过 10 个不同的词
		for (let i = 1; i <= 10; i++) {
			fireEvent.change(input, { target: { value: `动漫_${i}` } });
			fireEvent.submit(input.closest("form")!);
			await waitFor(() => {
				expect(screen.getByText(`动漫_${i}`)).toBeInTheDocument();
			});
		}
		// 历史记录不限数量，"柯南"和"xxx"不应被淘汰
		const historyList = JSON.parse(
			localStorage.getItem("animesh_search_history") || "[]",
		);
		expect(historyList.length).toBe(12);
		expect(historyList[0]).toBe("动漫_10");
		expect(historyList.includes("柯南")).toBe(true);
		expect(historyList.includes("xxx")).toBe(true);
	});

	it("点击历史搜索记录项时，应该将关键词填入输入框并触发搜索", async () => {
		localStorage.setItem("animesh_search_history", JSON.stringify(["柯南"]));
		vi.mocked(mockTorrentRepository.search).mockResolvedValue([]);

		renderHome();

		const historyItem = screen.getByText("柯南");
		fireEvent.click(historyItem);

		expect(screen.getByTestId("search-input")).toHaveValue("柯南");
		await waitFor(() => {
			expect(mockTorrentRepository.search).toHaveBeenCalledWith(
				expect.any(Object),
				"柯南",
				"dmhy",
			);
		});
	});

	it("点击删除单个历史记录按钮时，应该将其从列表中移除并更新 localStorage", async () => {
		localStorage.setItem(
			"animesh_search_history",
			JSON.stringify(["xxx", "柯南"]),
		);
		renderHome();

		expect(screen.getByText("xxx")).toBeInTheDocument();
		expect(screen.getByText("柯南")).toBeInTheDocument();

		const deleteBtn = screen.getByTestId("delete-history-xxx");
		fireEvent.click(deleteBtn);

		expect(screen.queryByText("xxx")).not.toBeInTheDocument();
		expect(screen.getByText("柯南")).toBeInTheDocument();
		expect(
			JSON.parse(localStorage.getItem("animesh_search_history") || "[]"),
		).toEqual(["柯南"]);
	});

	it("点击清空按钮时，应该清空所有历史记录并更新 localStorage", async () => {
		localStorage.setItem(
			"animesh_search_history",
			JSON.stringify(["xxx", "柯南"]),
		);
		renderHome();

		expect(screen.getByText("最近搜索:")).toBeInTheDocument();

		const clearBtn = screen.getByText("清空");
		fireEvent.click(clearBtn);

		expect(screen.queryByText("最近搜索:")).not.toBeInTheDocument();
		expect(screen.queryByText("xxx")).not.toBeInTheDocument();
		expect(screen.queryByText("柯南")).not.toBeInTheDocument();
		expect(localStorage.getItem("animesh_search_history")).toBeNull();
	});

	it("点击删除最后一个历史记录项时，应该清空历史记录并从 localStorage 移除该键", async () => {
		localStorage.setItem("animesh_search_history", JSON.stringify(["xxx"]));
		renderHome();

		expect(screen.getByText("xxx")).toBeInTheDocument();

		const deleteBtn = screen.getByTestId("delete-history-xxx");
		fireEvent.click(deleteBtn);

		expect(screen.queryByText("xxx")).not.toBeInTheDocument();
		expect(localStorage.getItem("animesh_search_history")).toBeNull();
	});

	it("当 localStorage 中的历史记录数据格式不合法时，应该降级初始化为空数组", () => {
		localStorage.setItem("animesh_search_history", "invalid-json{");
		renderHome();
		expect(screen.queryByText("最近搜索:")).not.toBeInTheDocument();
	});

	it("应该支持切换 AI 智能过滤模式，并调用 searchTorrentsWithAiUseCase 过滤并置顶高亮推荐结果", async () => {
		// Mock getSettingsUseCase 返回配置好的 AI 选项，使 UI 中的 AI 开关得以显示
		vi.spyOn(mockContainer.getSettingsUseCase, "execute").mockResolvedValue({
			download_dir: "/mock",
			ai_enabled: true,
			ai_api_endpoint: "https://api.openai.com/v1",
			ai_api_key: "test-key",
			trackers: [],
		});

		const mockAiResults = [
			{
				title: "AI 推荐：昨日青空 1080p",
				link: "http://example.com/1",
				pub_date: "2026-07-10",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 1500000000,
				ai_score: 95,
				ai_reason: "匹配 1080p 清晰度与简中字幕",
			},
		];

		// 劫持测试容器里的 searchTorrentsWithAiUseCase.execute
		vi.spyOn(
			mockContainer.searchTorrentsWithAiUseCase,
			"execute",
		).mockResolvedValue(mockAiResults);

		renderHome();

		// 等待加载设置并渲染 AI 开关
		await waitFor(() => {
			expect(screen.getByLabelText("✨ AI 智能过滤")).toBeInTheDocument();
		});

		const aiCheckbox = screen.getByLabelText(
			"✨ AI 智能过滤",
		) as HTMLInputElement;
		expect(aiCheckbox.checked).toBe(false); // 默认应该关闭

		// 开启 AI 模式开关
		fireEvent.click(aiCheckbox);
		expect(aiCheckbox.checked).toBe(true);

		// 输入框输入并搜索
		const input = screen.getByPlaceholderText("输入动漫名称");
		fireEvent.change(input, { target: { value: "昨日青空" } });
		fireEvent.submit(input.closest("form")!);

		// 验证过渡状态
		expect(screen.getByText(/AI 正在搜索/)).toBeInTheDocument();

		// 等待渲染 AI 推荐结果
		await waitFor(() => {
			expect(screen.getByText("AI 推荐：昨日青空 1080p")).toBeInTheDocument();
			expect(
				screen.getByText("匹配 1080p 清晰度与简中字幕"),
			).toBeInTheDocument();
		});

		expect(
			mockContainer.searchTorrentsWithAiUseCase.execute,
		).toHaveBeenCalled();
	});
});
