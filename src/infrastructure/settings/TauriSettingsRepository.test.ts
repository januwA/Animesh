import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TauriSettingsRepository } from "./TauriSettingsRepository";

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

			try {
				await repository.fetchTrackers("https://example.com/trackers.txt");
				expect(true).toBe(false); // Should not reach here
			} catch (err: any) {
				expect(err.message).toBe("获取 Tracker 列表网络连接失败");
				expect(err.cause).toBe(networkError);
			}
		});
	});
});
