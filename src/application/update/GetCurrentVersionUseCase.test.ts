import { describe, expect, it, vi } from "vitest";
import type { UpdateRepository } from "../../domain/update/UpdateRepository";
import { GetCurrentVersionUseCase } from "./GetCurrentVersionUseCase";

describe("GetCurrentVersionUseCase 单元测试", () => {
	const rawMockRepo = {
		getLatestRelease: vi.fn(),
		getCurrentVersion: vi.fn(),
	};
	const mockRepo = rawMockRepo as unknown as UpdateRepository;

	it("应该正确从 Repository 获取当前应用版本", async () => {
		const useCase = new GetCurrentVersionUseCase(mockRepo);
		vi.mocked(rawMockRepo.getCurrentVersion).mockResolvedValueOnce("0.3.1");

		const result = await useCase.execute();

		expect(rawMockRepo.getCurrentVersion).toHaveBeenCalled();
		expect(result).toBe("0.3.1");
	});
});
