import { Background, Canceled, WithCancel } from "ajanuw-context";
import { afterEach, describe, expect, it, vi } from "vitest";
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
});
