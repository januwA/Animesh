import { describe, expect, it, vi } from "vitest";
import type { OpenerRepository } from "../../domain/opener/OpenerRepository";
import { OpenUrlUseCase } from "./OpenUrlUseCase";

describe("OpenUrlUseCase 单元测试", () => {
	const rawMockRepo = {
		openUrl: vi.fn(),
	};
	const mockRepo = rawMockRepo as unknown as OpenerRepository;

	it("应该调用 Repository 的 openUrl 方法", async () => {
		const useCase = new OpenUrlUseCase(mockRepo);
		vi.mocked(rawMockRepo.openUrl).mockResolvedValueOnce(undefined);

		await useCase.execute("https://example.com");

		expect(rawMockRepo.openUrl).toHaveBeenCalledWith("https://example.com");
	});

	it("当 URL 为空时，应该抛出错误", async () => {
		const useCase = new OpenUrlUseCase(mockRepo);
		await expect(useCase.execute("")).rejects.toThrow("URL 不能为空");
	});
});
