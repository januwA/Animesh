import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TauriSettingsRepository } from "./TauriSettingsRepository";

const { mockInvoke } = vi.hoisted(() => ({
	mockInvoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
	invoke: mockInvoke,
}));

describe("基础设施层 TauriSettingsRepository", () => {
	let repository: TauriSettingsRepository;

	beforeEach(() => {
		repository = new TauriSettingsRepository();
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.resetAllMocks();
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
		it("应该正确从后端获取并解析设置，包含 AI 配置选项", async () => {
			const mockRawSettings = {
				download_dir: "/path/to/downloads",
				proxy: "http://127.0.0.1:7890",
				trackers: ["udp://tracker"],
				tracker_source_type: "custom",
				tracker_cdn: "none",
				tracker_custom_url: "",
				tracker_auto_update: true,
				tracker_last_update_time: 123456,
				ai_enabled: true,
				ai_api_key: "test-api-key",
				ai_api_endpoint: "https://api.openai.com/v1",
				ai_model: "gpt-4o",
			};
			mockInvoke.mockResolvedValueOnce(mockRawSettings);

			const result = await repository.getSettings();

			expect(mockInvoke).toHaveBeenCalledWith("settings_get");
			expect(result).toEqual(mockRawSettings);
		});

		it("当后端返回的数据结构与 Schema 不匹配时，应该抛出错误", async () => {
			const mockRawSettings = {
				download_dir: 123, // 应该是 string
			};
			mockInvoke.mockResolvedValueOnce(mockRawSettings);

			await expect(repository.getSettings()).rejects.toThrow(
				"Settings backend structure mismatch",
			);
		});
	});

	describe("setAiOptions 方法", () => {
		it("应该正确调用后端的 settings_set_ai_options 命令", async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const options = {
				enabled: true,
				apiKey: "test-api-key",
				apiEndpoint: "https://api.openai.com/v1",
				model: "gpt-4o",
			};

			await repository.setAiOptions(options);

			expect(mockInvoke).toHaveBeenCalledWith("settings_set_ai_options", {
				enabled: true,
				apiKey: "test-api-key",
				apiEndpoint: "https://api.openai.com/v1",
				model: "gpt-4o",
			});
		});
	});
});
