import { describe, expect, it, vi } from "vitest";
import type { UpdateRepository } from "../../domain/update/UpdateRepository";
import { CheckUpdateUseCase } from "./CheckUpdateUseCase";

describe("CheckUpdateUseCase 单元测试", () => {
	const rawMockRepo = {
		getLatestRelease: vi.fn(),
		getCurrentVersion: vi.fn(),
	};
	const mockRepo = rawMockRepo as unknown as UpdateRepository;

	it("当有新版本可用时，应该返回 hasUpdate 为 true 并携带正确的信息", async () => {
		const useCase = new CheckUpdateUseCase(mockRepo);
		vi.mocked(rawMockRepo.getLatestRelease).mockResolvedValueOnce({
			version: "0.3.2",
			notes: "修复了一些已知问题",
			pubDate: "2026-07-06T00:00:00Z",
			url: "https://example.com/download/v0.3.2",
			htmlUrl: "https://github.com/example/repo/releases/tag/v0.3.2",
		});
		vi.mocked(rawMockRepo.getCurrentVersion).mockResolvedValueOnce("0.3.1");

		const result = await useCase.execute();

		expect(rawMockRepo.getLatestRelease).toHaveBeenCalled();
		expect(rawMockRepo.getCurrentVersion).toHaveBeenCalled();
		expect(result).toEqual({
			hasUpdate: true,
			latestVersion: "0.3.2",
			currentVersion: "0.3.1",
			notes: "修复了一些已知问题",
			url: "https://example.com/download/v0.3.2",
			htmlUrl: "https://github.com/example/repo/releases/tag/v0.3.2",
		});
	});

	it("当当前版本已经是最新或更高时，应该返回 hasUpdate 为 false", async () => {
		const useCase = new CheckUpdateUseCase(mockRepo);
		vi.mocked(rawMockRepo.getLatestRelease).mockResolvedValueOnce({
			version: "0.3.1",
			notes: "没有新内容",
			htmlUrl: "https://github.com/example/repo/releases/tag/v0.3.1",
		});
		vi.mocked(rawMockRepo.getCurrentVersion).mockResolvedValueOnce("0.3.1");

		const result = await useCase.execute();

		expect(result.hasUpdate).toBe(false);
		expect(result.latestVersion).toBe("0.3.1");
	});

	it("当获取更新信息失败时，应该向上抛出错误并保留错误链", async () => {
		const useCase = new CheckUpdateUseCase(mockRepo);
		const originalError = new Error("网络超时");
		vi.mocked(rawMockRepo.getLatestRelease).mockRejectedValue(originalError);
		vi.mocked(rawMockRepo.getCurrentVersion).mockResolvedValue("0.3.1");

		await expect(useCase.execute()).rejects.toThrow("检查更新失败");

		const resultError = await useCase
			.execute()
			.catch((err: unknown) => err as Error);
		expect(resultError.cause).toBe(originalError);
	});
});
