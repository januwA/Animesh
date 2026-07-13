import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpSettingsRepository } from "./HttpSettingsRepository";

describe("基础设施层 HttpSettingsRepository", () => {
	let repository: HttpSettingsRepository;

	beforeEach(() => {
		repository = new HttpSettingsRepository();
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("fetchTrackers 网络同步方法", () => {
		it("当接口请求成功时，应该正确拉取并解析在线 Tracker 文本内容", async () => {
			const mockText =
				"udp://tracker.opentrackr.org:1337/announce\nhttp://tracker.gbitt.info:80/announce";
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => mockText,
			} as Response);

			const result = await repository.fetchTrackers(
				"https://example.com/trackers.txt",
			);
			expect(fetch).toHaveBeenCalledWith("https://example.com/trackers.txt");
			expect(result).toEqual([
				"udp://tracker.opentrackr.org:1337/announce",
				"http://tracker.gbitt.info:80/announce",
			]);
		});

		it("当接口返回非 200/ok 状态码时，应该正确抛出异常", async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: "Not Found",
			} as Response);

			await expect(
				repository.fetchTrackers("https://example.com/trackers.txt"),
			).rejects.toThrow("获取 Tracker 列表失败: HTTP 404 Not Found");
		});

		it("当网络请求遇到物理断开或 DNS 故障抛出错误时，应该使用 cause 保留原始错误链", async () => {
			const networkError = new Error("DNS resolution failed");
			vi.mocked(fetch).mockRejectedValueOnce(networkError);

			const promise = repository.fetchTrackers(
				"https://example.com/trackers.txt",
			);
			await expect(promise).rejects.toThrow("获取 Tracker 列表网络连接失败");
			const err = await promise.catch((e) => e);
			expect(err.cause).toBe(networkError);
		});
	});

	describe("getSettings 方法", () => {
		it("应该从 API 获取设置，并且包含 AI 配置项且返回解析后的数据", async () => {
			const mockRawSettings = {
				download_dir: "/downloads",
				proxy: "socks5://127.0.0.1:1080",
				trackers: ["http://tracker1", "http://tracker2"],
				tracker_source_type: "custom",
				tracker_cdn: "none",
				tracker_custom_url: "",
				tracker_auto_update: true,
				tracker_last_update_time: 1718880000,
				ai_configs: [
					{
						alias: "OpenAI",
						api_endpoint: "https://api.openai.com/v1",
						api_key: "ai-api-key",
						ai_model: "gpt-4o",
					},
				],
			};

			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => mockRawSettings,
			} as Response);

			const settings = await repository.getSettings();

			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/settings"),
				expect.objectContaining({ method: "GET" }),
			);
			expect(settings).toEqual(mockRawSettings);
		});

		it("当接口返回的数据格式不匹配 Schema 时，应该抛出错误", async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ download_dir: 1234 }), // type mismatch
			} as Response);

			await expect(repository.getSettings()).rejects.toThrow(
				"Settings backend structure mismatch",
			);
		});
	});

	describe("setAiConfigs 方法", () => {
		it("应该发送 PUT 请求至 /api/settings/ai-configs 并携带正确的 JSON payload", async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => "",
			} as Response);

			await repository.setAiConfigs([
				{
					alias: "OpenAI",
					api_endpoint: "https://api.openai.com/v1",
					api_key: "ai-api-key",
					ai_model: "gpt-4o",
				},
			]);

			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/settings/ai-configs"),
				expect.objectContaining({
					method: "PUT",
					headers: expect.objectContaining({
						"Content-Type": "application/json",
					}),
					body: JSON.stringify({
						configs: [
							{
								alias: "OpenAI",
								api_endpoint: "https://api.openai.com/v1",
								api_key: "ai-api-key",
								ai_model: "gpt-4o",
							},
						],
					}),
				}),
			);
		});
	});
});
