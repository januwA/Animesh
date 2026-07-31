import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { createDIContainerForTest } from "@/test/test-utils";
import { NavBarLayout } from "../components/Layout";
import { AppContextProvider } from "../context/AppContext";
import LivePlayer from "./LivePlayer";

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

const findVideo = async (): Promise<HTMLVideoElement> => {
	await waitFor(() => {
		expect(document.querySelector("video")).toBeInTheDocument();
	});
	return document.querySelector("video") as unknown as HTMLVideoElement;
};

describe("LivePlayer 页面组件", () => {
	let mockContainer: DIContainer;

	beforeEach(() => {
		mockContainer = createDIContainerForTest({});
		currentLocation.current = null;
		vi.clearAllMocks();
		vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
	});

	const renderLivePlayer = (search = "", initialEntries?: string[]) => {
		return render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter
						initialEntries={initialEntries ?? [`/live/play${search}`]}
						initialIndex={initialEntries ? initialEntries.length - 1 : 0}
					>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<NavBarLayout />}>
								<Route path="live" element={<div>Live List</div>} />
								<Route path="live/play" element={<LivePlayer />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);
	};

	it("当提供直播地址时，应该渲染播放器并展示频道信息", async () => {
		renderLivePlayer(
			"?url=http%3A%2F%2Fexample.com%2Flive.m3u8&name=CCTV-1&logo=http%3A%2F%2Fexample.com%2Flogo.png&category=新闻",
		);

		expect(screen.getByText("CCTV-1")).toBeInTheDocument();
		expect(screen.getByText("新闻")).toBeInTheDocument();
		expect(
			screen.getByText("直播", { selector: ".text-xs" }),
		).toBeInTheDocument();

		const video = await findVideo();
		expect(video).toHaveAttribute("src", "http://example.com/live.m3u8");
	});

	it("当缺少频道名称和 logo 时，应该渲染占位信息", async () => {
		renderLivePlayer("?url=http%3A%2F%2Fexample.com%2Flive.m3u8");

		expect(screen.getByText("未命名频道")).toBeInTheDocument();
		expect(
			screen.getByText("直播", { selector: ".text-xs" }),
		).toBeInTheDocument();
		await waitFor(() =>
			expect(document.querySelector("video")).toBeInTheDocument(),
		);
	});

	it("当缺少直播地址时，应该显示无效地址提示", () => {
		renderLivePlayer("?name=CCTV-1");

		expect(screen.getByText("无效的直播地址")).toBeInTheDocument();
		expect(document.querySelector("video")).not.toBeInTheDocument();
	});

	it("直播源应经本地代理地址播放", async () => {
		mockContainer = createDIContainerForTest({
			iptvStreamUrlRepository: {
				resolvePlayableStreamUrl: async (rawUrl) =>
					`http://127.0.0.1:1234/iptv-proxy?url=${encodeURIComponent(rawUrl)}`,
			},
		});
		renderLivePlayer("?url=http%3A%2F%2Fexample.com%2Flive.m3u8");

		const video = await findVideo();
		expect(video).toHaveAttribute(
			"src",
			"http://127.0.0.1:1234/iptv-proxy?url=http%3A%2F%2Fexample.com%2Flive.m3u8",
		);
	});

	it("解析直播源期间应展示加载状态", async () => {
		let resolveUrl: ((value: string) => void) | null = null;
		mockContainer = createDIContainerForTest({
			iptvStreamUrlRepository: {
				resolvePlayableStreamUrl: () =>
					new Promise<string>((resolve) => {
						resolveUrl = resolve;
					}),
			},
		});
		renderLivePlayer("?url=http%3A%2F%2Fexample.com%2Flive.m3u8");

		expect(screen.getByText("正在加载直播源...")).toBeInTheDocument();
		expect(document.querySelector("video")).not.toBeInTheDocument();

		await act(async () => {
			resolveUrl?.("http://127.0.0.1:1234/iptv-proxy?url=x");
		});

		const video = await findVideo();
		expect(video).toHaveAttribute(
			"src",
			"http://127.0.0.1:1234/iptv-proxy?url=x",
		);
	});

	it("解析成功且组件已卸载时不应再更新状态", async () => {
		let resolveUrl!: (value: string) => void;
		mockContainer = createDIContainerForTest({
			iptvStreamUrlRepository: {
				resolvePlayableStreamUrl: () =>
					new Promise<string>((resolve) => {
						resolveUrl = resolve;
					}),
			},
		});
		const { unmount } = renderLivePlayer(
			"?url=http%3A%2F%2Fexample.com%2Flive.m3u8",
		);

		unmount();
		await act(async () => {
			resolveUrl("proxied");
		});
	});

	it("解析失败时应回退为原始地址播放", async () => {
		mockContainer = createDIContainerForTest({
			iptvStreamUrlRepository: {
				resolvePlayableStreamUrl: async () => {
					throw new Error("resolve failed");
				},
			},
		});
		renderLivePlayer("?url=http%3A%2F%2Fexample.com%2Flive.m3u8");

		const video = await findVideo();
		expect(video).toHaveAttribute("src", "http://example.com/live.m3u8");
	});

	it("解析失败且组件已卸载时不应再更新状态", async () => {
		let rejectUrl!: (err: Error) => void;
		mockContainer = createDIContainerForTest({
			iptvStreamUrlRepository: {
				resolvePlayableStreamUrl: () =>
					new Promise<string>((_, reject) => {
						rejectUrl = reject;
					}),
			},
		});
		const { unmount } = renderLivePlayer(
			"?url=http%3A%2F%2Fexample.com%2Flive.m3u8",
		);

		unmount();
		await act(async () => {
			rejectUrl(new Error("resolve failed"));
		});
	});

	it("应该展示原始直播流地址", async () => {
		renderLivePlayer("?url=http%3A%2F%2Fexample.com%2Flive.m3u8&name=CCTV-1");

		await findVideo();

		expect(
			screen.getByText("原始直播源地址", { selector: ".text-xs" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("http://example.com/live.m3u8"),
		).toBeInTheDocument();
	});

	it("点击复制按钮应把原始地址复制到剪贴板", async () => {
		renderLivePlayer("?url=http%3A%2F%2Fexample.com%2Flive.m3u8&name=CCTV-1");

		fireEvent.click(screen.getByRole("button", { name: "复制" }));

		await waitFor(() =>
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
				"http://example.com/live.m3u8",
			),
		);
		await waitFor(() =>
			expect(toast.success).toHaveBeenCalledWith(
				"直播源地址已复制，可添加到代理规则中",
			),
		);
	});

	it("复制失败时应提示错误", async () => {
		vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
			new Error("denied"),
		);
		renderLivePlayer("?url=http%3A%2F%2Fexample.com%2Flive.m3u8");

		fireEvent.click(screen.getByRole("button", { name: "复制" }));

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith("复制失败，请手动复制"),
		);
	});

	it("当缺少直播地址时不应展示原始地址区域", () => {
		renderLivePlayer("?name=CCTV-1");

		expect(screen.queryByText("原始直播源地址")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "复制" }),
		).not.toBeInTheDocument();
	});

	it("当点击返回按钮时，应该返回上一页", async () => {
		renderLivePlayer("?url=http%3A%2F%2Fexample.com%2Flive.m3u8&name=CCTV-1", [
			"/live",
			"/live/play?url=http%3A%2F%2Fexample.com%2Flive.m3u8&name=CCTV-1",
		]);

		await findVideo();
		fireEvent.click(screen.getByRole("button", { name: "返回" }));

		expect(currentLocation.current?.pathname).toBe("/live");
	});

	it("应该针对各种视频错误提示正确的错误信息", async () => {
		renderLivePlayer("?url=http%3A%2F%2Fexample.com%2Flive.m3u8&name=CCTV-1");

		await waitFor(() =>
			expect(document.querySelector("video")).toBeInTheDocument(),
		);

		const vjsMock = (globalThis as any).__vjsMock;

		await act(() => {
			vjsMock.setError({ code: 4 });
			vjsMock.trigger();
		});
		expect(toast.error).toHaveBeenCalledWith("当前浏览器不支持播放该直播源。", {
			duration: 8000,
		});

		await act(() => {
			vjsMock.setError({ code: 3 });
			vjsMock.trigger();
		});
		expect(toast.error).toHaveBeenCalledWith(
			"直播流解码失败，可能源地址已失效或编码不支持。",
			{ duration: 8000 },
		);

		await act(() => {
			vjsMock.setError({ code: 2 });
			vjsMock.trigger();
		});
		expect(toast.error).toHaveBeenCalledWith("直播流加载超时或网络断开。", {
			duration: 8000,
		});

		await act(() => {
			vjsMock.setError({ code: 0 });
			vjsMock.trigger();
		});
		expect(toast.error).toHaveBeenCalledWith("直播流加载失败", {
			duration: 8000,
		});
	});

	it("在播放器渲染后卸载组件时，应该正常清理", async () => {
		const { unmount } = renderLivePlayer(
			"?url=http%3A%2F%2Fexample.com%2Flive.m3u8&name=CCTV-1",
		);

		await findVideo();
		unmount();
	});
});
