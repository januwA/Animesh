import { invoke } from "@tauri-apps/api/core";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";

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

describe("App 组件", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("应该正确渲染标题 and 副标题", () => {
		render(<App />);
		expect(
			screen.getByRole("heading", { name: "Animesh" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("BT 边下边播 & 磁力聚合搜索客户端"),
		).toBeInTheDocument();
	});

	it("当输入关键词并搜索成功时，应该显示结果并可以点击操作", async () => {
		const mockResults = [
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000, // ~333.79 MB
			},
			{
				title: "凡人修仙传 第2集",
				link: "http://example.com/2",
				pub_date: "2026-06-24",
				magnet: "magnet:?xt=urn:btih:TEST2",
				size: 1500, // ~1.46 KB
			},
			{
				title: "凡人修仙传 第3集",
				link: "http://example.com/3",
				pub_date: "2026-06-25",
				magnet: "magnet:?xt=urn:btih:TEST3",
				size: 0, // 未知大小
			},
		];
		vi.mocked(invoke).mockResolvedValue(mockResults);

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		const button = screen.getByRole("button", { name: "搜索" });

		// 输入关键词并搜索
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.click(button);

		// 应该进入 loading 状态
		expect(
			screen.getByText("正在获取 动漫花园 资源列表..."),
		).toBeInTheDocument();

		// 等待加载完成并显示结果
		await waitFor(() => {
			const count = document.querySelector(".results-count");
			expect(count).toBeInTheDocument();
			expect(count?.textContent?.replace(/\s+/g, " ").trim()).toBe(
				"找到 3 个资源",
			);
		});

		expect(invoke).toHaveBeenCalledWith("search_dmhy", { keyword: "凡人" });

		// 检查资源渲染
		expect(screen.getByText("凡人修仙传 第1集")).toBeInTheDocument();
		expect(screen.getByText("333.79 MB")).toBeInTheDocument();
		expect(screen.getByText("1.46 KB")).toBeInTheDocument();
		expect(screen.getByText("未知大小")).toBeInTheDocument();

		// 在触发点击前启动 fake timers，这样 setTimeout 就会注册在 fake timer 队列里
		vi.useFakeTimers();

		// 点击复制磁力按钮
		const copyButtons = screen.getAllByRole("button", { name: "🧲 复制磁力" });
		fireEvent.click(copyButtons[0]);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			"magnet:?xt=urn:btih:TEST1",
		);

		// 推进 fake timers 使得 async clipboard 对应的微任务以及 toast 显示状态更新被刷新
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getByText("磁力链接已复制到剪贴板")).toBeInTheDocument();

		// 推进 3000ms 让 Toast 消失
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(
			screen.queryByText("磁力链接已复制到剪贴板"),
		).not.toBeInTheDocument();

		// 暂时切回 real timers 确保状态干净，然后切到 fake timers 触发播放
		vi.useRealTimers();
		vi.useFakeTimers();

		// 点击边下边播按钮
		const playButtons = screen.getAllByRole("button", { name: "▶ 边下边播" });
		fireEvent.click(playButtons[0]);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(
			screen.getByText("正在启动下载流媒体引擎: 凡人修仙传 第1集..."),
		).toBeInTheDocument();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(
			screen.queryByText("正在启动下载流媒体引擎: 凡人修仙传 第1集..."),
		).not.toBeInTheDocument();

		vi.useRealTimers();
	});

	it("当搜索失败时，应该显示错误提示", async () => {
		vi.mocked(invoke).mockRejectedValue("网络请求超时");

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.submit(input); // 可以直接回车提交

		await waitFor(() => {
			expect(screen.getByText("网络请求超时")).toBeInTheDocument();
		});
	});

	it("当搜索抛出非字符串错误时，应该显示默认错误提示", async () => {
		vi.mocked(invoke).mockRejectedValueOnce(new Error("Internal Server Error"));

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));

		await waitFor(() => {
			expect(
				screen.getByText("搜索失败，请检查网络或重试"),
			).toBeInTheDocument();
		});
	});

	it("当搜索结果为空时，应该显示无资源提示", async () => {
		vi.mocked(invoke).mockResolvedValue([]);

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "不存在的动漫" } });
		fireEvent.submit(input);

		await waitFor(() => {
			expect(
				screen.getByText("未找到相关资源，请换个关键词试试"),
			).toBeInTheDocument();
		});
	});

	it("当复制磁力链接失败时，应该显示失败提示", async () => {
		vi.mocked(invoke).mockResolvedValue([
			{
				title: "凡人修仙传 第1集",
				link: "http://example.com/1",
				pub_date: "2026-06-23",
				magnet: "magnet:?xt=urn:btih:TEST1",
				size: 350000000,
			},
		]);
		vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
			new Error("Permission denied"),
		);

		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "凡人" } });
		fireEvent.click(screen.getByRole("button", { name: "搜索" }));

		await waitFor(() => {
			const count = document.querySelector(".results-count");
			expect(count).toBeInTheDocument();
			expect(count?.textContent?.replace(/\s+/g, " ").trim()).toBe(
				"找到 1 个资源",
			);
		});

		// 在触发点击前启动 fake timers，这样 setTimeout 就会注册在 fake timer 队列里
		vi.useFakeTimers();

		const copyBtn = screen.getByRole("button", { name: "🧲 复制磁力" });
		fireEvent.click(copyBtn);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getByText("复制失败，请手动复制")).toBeInTheDocument();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(screen.queryByText("复制失败，请手动复制")).not.toBeInTheDocument();

		vi.useRealTimers();
	});

	it("当输入空白关键词并提交时，不应该触发搜索", async () => {
		render(<App />);

		const input = screen.getByPlaceholderText(
			"输入动漫名称，例如：凡人修仙传...",
		);
		fireEvent.change(input, { target: { value: "   " } });
		fireEvent.submit(input);

		expect(invoke).not.toHaveBeenCalled();
	});
});
