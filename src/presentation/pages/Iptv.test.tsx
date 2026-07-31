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
import type { IptvRepository } from "@/domain/iptv/IptvRepository";
import { createDIContainerForTest } from "@/test/test-utils";
import { NavBarLayout } from "../components/Layout";
import { AppContextProvider } from "../context/AppContext";
import IptvPage from "./Iptv";

const currentLocation = {
	current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
	currentLocation.current = useLocation();
	return null;
};

const mockCountries = [
	{ name: "中国", code: "CN", flag: "🇨🇳" },
	{ name: "日本", code: "JP", flag: "🇯🇵" },
];

const mockChannels = [
	{
		tvgId: "cctv1",
		name: "CCTV-1",
		logo: "http://example.com/cctv1.png",
		category: "新闻",
		url: "http://example.com/cctv1.m3u8",
	},
	{
		tvgId: "cctv6",
		name: "CCTV-6",
		logo: null,
		category: "电影",
		url: "http://example.com/cctv6.m3u8",
	},
	{
		tvgId: null,
		name: "测试频道",
		logo: null,
		category: null,
		url: "http://example.com/test.m3u8",
	},
];

describe("Iptv 页面组件", () => {
	let mockIptvRepository: IptvRepository;
	let mockContainer: DIContainer;

	const renderIptv = (repo?: Partial<IptvRepository>, logger?: unknown) => {
		mockIptvRepository = {
			getCountries: vi.fn().mockResolvedValue(mockCountries),
			getChannels: vi.fn().mockResolvedValue(mockChannels),
			...repo,
		};

		mockContainer = createDIContainerForTest({
			iptvRepository: mockIptvRepository,
			logger: logger as never,
		});

		return render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/live"]}>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<NavBarLayout />}>
								<Route path="live" element={<IptvPage />} />
								<Route path="live/play" element={<div>Live Play</div>} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);
	};

	beforeEach(() => {
		currentLocation.current = null;
		vi.clearAllMocks();
	});

	it("应该展示国家下拉、分类筛选、频道列表和统计信息", async () => {
		renderIptv();

		expect(screen.getByRole("combobox")).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText("CCTV-1")).toBeInTheDocument();
		});
		expect(screen.getByText("CCTV-6")).toBeInTheDocument();
		expect(screen.getByText("测试频道")).toBeInTheDocument();
		expect(screen.getByText("共 3 个频道")).toBeInTheDocument();

		expect(screen.getByRole("radio", { name: "全部" })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "新闻" })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "电影" })).toBeInTheDocument();

		expect(mockIptvRepository.getCountries).toHaveBeenCalledTimes(1);
		expect(mockIptvRepository.getChannels).toHaveBeenCalledWith(
			expect.anything(),
			"CN",
		);
	});

	it("应该支持点击分类筛选频道，并支持取消选中回到全部", async () => {
		renderIptv();

		await waitFor(() => {
			expect(screen.getByText("CCTV-1")).toBeInTheDocument();
		});

		const newsChip = screen.getByRole("radio", { name: "新闻" });
		await act(async () => {
			fireEvent.click(newsChip);
		});

		expect(screen.getByText("CCTV-1")).toBeInTheDocument();
		expect(screen.queryByText("CCTV-6")).not.toBeInTheDocument();
		expect(screen.getByText("共 1 个频道")).toBeInTheDocument();

		await act(async () => {
			fireEvent.click(newsChip);
		});

		expect(screen.getByText("CCTV-6")).toBeInTheDocument();
	});

	it("应该支持按名称、tvg-id、分类搜索频道，并展示无结果空状态", async () => {
		renderIptv();

		await waitFor(() => {
			expect(screen.getByText("CCTV-1")).toBeInTheDocument();
		});

		const input = screen.getByPlaceholderText("搜索频道...");

		await act(async () => {
			fireEvent.change(input, { target: { value: "cctv" } });
		});
		expect(screen.getByText("CCTV-1")).toBeInTheDocument();
		expect(screen.getByText("CCTV-6")).toBeInTheDocument();
		expect(screen.queryByText("测试频道")).not.toBeInTheDocument();
		expect(screen.getByText("共 2 个频道")).toBeInTheDocument();

		await act(async () => {
			fireEvent.change(input, { target: { value: "cctv1" } });
		});
		expect(screen.getByText("CCTV-1")).toBeInTheDocument();
		expect(screen.queryByText("CCTV-6")).not.toBeInTheDocument();

		await act(async () => {
			fireEvent.change(input, { target: { value: "电影" } });
		});
		expect(screen.getByText("CCTV-6")).toBeInTheDocument();
		expect(screen.queryByText("CCTV-1")).not.toBeInTheDocument();

		await act(async () => {
			fireEvent.change(input, { target: { value: "不存在xyz" } });
		});
		expect(screen.getByText("没有符合筛选条件的频道")).toBeInTheDocument();
	});

	it("应该支持切换国家并加载对应国家的频道", async () => {
		renderIptv({
			getChannels: vi.fn().mockImplementation((_ctx: unknown, code: string) =>
				code === "JP"
					? Promise.resolve([
							{
								tvgId: "nhk",
								name: "NHK",
								logo: null,
								category: "综合",
								url: "http://example.com/nhk.m3u8",
							},
						])
					: Promise.resolve(mockChannels),
			),
		});

		await waitFor(() => {
			expect(screen.getByText("CCTV-1")).toBeInTheDocument();
		});

		const selectTrigger = screen.getByRole("combobox");
		await act(async () => {
			fireEvent.click(selectTrigger);
		});
		const jpOption = screen.getByRole("option", { name: /日本/ });
		await act(async () => {
			fireEvent.click(jpOption);
		});

		await waitFor(() => {
			expect(mockIptvRepository.getChannels).toHaveBeenCalledWith(
				expect.anything(),
				"JP",
			);
		});
		await waitFor(() => {
			expect(screen.getByText("NHK")).toBeInTheDocument();
		});
	});

	it("当国家列表为空或缺少当前选中国家时，应该展示默认中国选项", async () => {
		renderIptv({ getCountries: vi.fn().mockResolvedValue([]) });

		await waitFor(() => {
			expect(screen.getByText("CCTV-1")).toBeInTheDocument();
		});

		const selectTrigger = screen.getByRole("combobox");
		await act(async () => {
			fireEvent.click(selectTrigger);
		});

		expect(screen.getByRole("option", { name: /中国/ })).toBeInTheDocument();
	});

	it("应该渲染无 logo 和无分类的频道占位图标", async () => {
		renderIptv();

		await waitFor(() => {
			expect(screen.getByText("测试频道")).toBeInTheDocument();
		});

		expect(screen.getByText("CCTV-1")).toBeInTheDocument();
		expect(
			screen.queryByText("测试频道", { selector: "h3" }),
		).toBeInTheDocument();
	});

	it("当点击频道卡片时，应该跳转到直播播放页并携带参数", async () => {
		renderIptv();

		await waitFor(() => {
			expect(screen.getByText("测试频道")).toBeInTheDocument();
		});

		const channelCard = screen.getByTitle("播放: 测试频道");
		await act(async () => {
			fireEvent.click(channelCard);
		});

		expect(currentLocation.current?.pathname).toBe("/live/play");
		const searchParams = new URLSearchParams(
			currentLocation.current?.search ?? "",
		);
		expect(searchParams.get("url")).toBe("http://example.com/test.m3u8");
		expect(searchParams.get("name")).toBe("测试频道");
		expect(searchParams.get("logo")).toBe("");
		expect(searchParams.get("category")).toBe("");
	});

	it("当获取频道列表失败时，应该显示错误提示", async () => {
		renderIptv({
			getChannels: vi.fn().mockRejectedValue(new Error("API error")),
		});

		await waitFor(() => {
			expect(
				screen.getByText("获取频道列表失败，请检查网络或重试", {
					exact: false,
				}),
			).toBeInTheDocument();
		});
	});

	it("当获取频道列表失败时，不应该显示频道统计信息", async () => {
		renderIptv({
			getChannels: vi.fn().mockRejectedValue(new Error("API error")),
		});

		await waitFor(() => {
			expect(
				screen.getByText("获取频道列表失败，请检查网络或重试", {
					exact: false,
				}),
			).toBeInTheDocument();
		});

		expect(screen.queryByText(/^共 \d+ 个频道$/)).not.toBeInTheDocument();
	});

	it("当频道列表为空时，应该显示该国家暂无频道", async () => {
		renderIptv({ getChannels: vi.fn().mockResolvedValue([]) });

		await waitFor(() => {
			expect(screen.getByText("该国家暂无频道")).toBeInTheDocument();
		});
	});

	it("在频道加载过程中，应该显示骨架屏", async () => {
		const { unmount } = renderIptv({
			getChannels: vi.fn().mockReturnValue(new Promise(() => {})),
		});

		expect(
			document.querySelector('[data-slot="skeleton"]'),
		).toBeInTheDocument();
		expect(screen.queryByText(/^共 \d+ 个频道$/)).not.toBeInTheDocument();

		unmount();
	});

	it("当获取国家列表失败时，应该记录日志且不影响频道加载", async () => {
		const warnSpy = vi.fn();
		const mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: warnSpy,
			error: vi.fn(),
			withCategory: () => mockLogger,
		};

		renderIptv(
			{
				getCountries: vi.fn().mockRejectedValue(new Error("boom")),
			},
			mockLogger,
		);

		await waitFor(() => {
			expect(warnSpy).toHaveBeenCalled();
		});

		await waitFor(() => {
			expect(screen.getByText("CCTV-1")).toBeInTheDocument();
		});
	});

	it("当组件在请求完成前卸载时，不应该更新状态", async () => {
		let resolveCountries: (value: unknown) => void = () => {};
		let resolveChannels: (value: unknown) => void = () => {};

		const { unmount } = renderIptv({
			getCountries: vi.fn().mockReturnValue(
				new Promise((resolve) => {
					resolveCountries = resolve;
				}),
			),
			getChannels: vi.fn().mockReturnValue(
				new Promise((resolve) => {
					resolveChannels = resolve;
				}),
			),
		});

		await act(async () => {
			unmount();
		});
		await act(async () => {
			resolveCountries(mockCountries);
			resolveChannels(mockChannels);
		});
	});

	it("当组件在请求失败前卸载时，不应该记录日志或设置错误状态", async () => {
		let rejectCountries: (reason: unknown) => void = () => {};
		let rejectChannels: (reason: unknown) => void = () => {};

		const warnSpy = vi.fn();
		const mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: warnSpy,
			error: vi.fn(),
			withCategory: () => mockLogger,
		};

		const { unmount } = renderIptv(
			{
				getCountries: vi.fn().mockReturnValue(
					new Promise((_, reject) => {
						rejectCountries = reject;
					}),
				),
				getChannels: vi.fn().mockReturnValue(
					new Promise((_, reject) => {
						rejectChannels = reject;
					}),
				),
			},
			mockLogger,
		);

		await act(async () => {
			unmount();
		});
		await act(async () => {
			rejectCountries(new Error("boom"));
			rejectChannels(new Error("boom"));
		});

		expect(warnSpy).not.toHaveBeenCalled();
	});
});
