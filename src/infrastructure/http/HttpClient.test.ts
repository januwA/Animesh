import { afterEach, describe, expect, it, vi } from "vitest";
import { Background, WithCancel } from "../../crosscutting/context/context";
import { Canceled } from "../../crosscutting/context/interface";
import { HttpClient } from "./HttpClient";

describe("HttpClient", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("能够成功发送 GET 请求并解析 JSON", async () => {
		const mockData = { foo: "bar" };
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockData,
		} as Response);
		vi.stubGlobal("fetch", mockFetch);

		const client = new HttpClient();
		const result = await client.getJson("https://api.example.com/test");

		expect(mockFetch).toHaveBeenCalledWith(
			"https://api.example.com/test",
			expect.objectContaining({
				method: "GET",
				headers: { Accept: "application/json" },
			}),
		);
		expect(result).toEqual(mockData);
	});

	it("在 HTTP 响应不成功时抛出错误", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			statusText: "Not Found",
		} as Response);
		vi.stubGlobal("fetch", mockFetch);

		const client = new HttpClient();
		await expect(
			client.getJson("https://api.example.com/test"),
		).rejects.toThrow("HTTP error! status: 404 Not Found");
	});

	it("如果 Context 在请求前已被取消，应立即抛出 Context 错误", async () => {
		const mockFetch = vi.fn();
		vi.stubGlobal("fetch", mockFetch);

		const [ctx, cancel] = WithCancel(Background);
		cancel();

		const client = new HttpClient();
		await expect(
			client.getJson("https://api.example.com/test", { ctx }),
		).rejects.toThrow(Canceled.message);

		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("如果 Context 在请求中被取消，应中止请求并抛出 Context 错误", async () => {
		vi.useFakeTimers();

		const abortError = new Error("The user aborted a request.");
		abortError.name = "AbortError";

		// 模拟 fetch 挂起，且会在 abort signal 触发时拒绝
		const mockFetch = vi.fn().mockImplementation((_url, options) => {
			return new Promise((_resolve, reject) => {
				if (options?.signal) {
					options.signal.addEventListener("abort", () => {
						reject(abortError);
					});
				}
			});
		});
		vi.stubGlobal("fetch", mockFetch);

		const [ctx, cancel] = WithCancel(Background);
		const client = new HttpClient();

		const requestPromise = client.getJson("https://api.example.com/test", {
			ctx,
		});

		// 触发 context 取消
		cancel();
		await Promise.resolve(); // 让 microtask 队列执行以触发 controller.abort

		await expect(requestPromise).rejects.toThrow(Canceled.message);

		vi.useRealTimers();
	});
});
