import { invoke } from "@tauri-apps/api/core";
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
import Home from "./Home";

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

const currentLocation = {
	current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
	currentLocation.current = useLocation();
	return null;
};

describe("Home 页面组件", () => {
	beforeEach(() => {
		currentLocation.current = null;
		vi.clearAllMocks();
		vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("应该正确渲染搜索表单和欢迎指南", () => {
		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/"]}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route index element={<Home />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);
		expect(
			screen.getByPlaceholderText("输入动漫名称，例如：凡人修仙传..."),
		).toBeInTheDocument();
		expect(screen.getByText("聚合搜索")).toBeInTheDocument();
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

		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "search_dmhy") {
				return mockResults;
			}
			return null;
		});

		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/"]}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route index element={<Home />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

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
		expect(invoke).toHaveBeenCalledWith("search_dmhy", { keyword: "凡人" });
	});

	it("当搜索返回空/undefined结果时，应该降级使用空数组并显示无资源提示", async () => {
		vi.mocked(invoke).mockImplementation(async (cmd) => {
			if (cmd === "search_dmhy") {
				return null;
			}
			return null;
		});

		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/"]}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="" element={<Home />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

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
		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/"]}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="" element={<Home />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

		const input = screen.getByPlaceholderText(
				"输入动漫名称，例如：凡人修仙传...",
			),
			button = screen.getByRole("button", { name: "搜索" });

		fireEvent.change(input, { target: { value: "   " } });
		fireEvent.click(button);

		expect(invoke).not.toHaveBeenCalled();
	});

	it("当搜索失败时，应该显示错误提示", async () => {
		vi.mocked(invoke).mockRejectedValue("网络请求超时");

		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/"]}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="" element={<Home />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

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
		vi.mocked(invoke).mockRejectedValueOnce(new Error("Internal Server Error"));

		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/"]}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="" element={<Home />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

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
		vi.mocked(invoke).mockResolvedValue(mockResults);

		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/"]}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="" element={<Home />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

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
		vi.mocked(invoke).mockResolvedValue(mockResults);
		vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
			new Error("Permission denied"),
		);

		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/"]}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route path="" element={<Home />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

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
		vi.mocked(invoke).mockResolvedValue(mockResults);

		render(
			<AppContextProvider>
				<MemoryRouter initialEntries={["/"]}>
					<LocationTracker />
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route index element={<Home />} />
							<Route path="torrent" element={<div>TorrentDetail Page</div>} />
						</Route>
					</Routes>
				</MemoryRouter>
			</AppContextProvider>,
		);

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
});
