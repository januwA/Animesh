import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { UpdateRepository } from "../../domain/update/UpdateRepository";
import { OpenUpdateUrlUseCase } from "./OpenUpdateUrlUseCase";

describe("OpenUpdateUrlUseCase 单元测试", () => {
  const rawMockRepo = {
    getLatestRelease: vi.fn(),
    getCurrentVersion: vi.fn(),
    openUrl: vi.fn(),
  };
  const mockRepo = rawMockRepo as unknown as UpdateRepository;

  it("应该调用 Repository 的 openUrl 方法", async () => {
    const useCase = new OpenUpdateUrlUseCase(mockRepo);
    vi.mocked(rawMockRepo.openUrl).mockResolvedValueOnce(undefined);

    await useCase.execute(NonEmptyStringSchema.parse("https://example.com"));

    expect(rawMockRepo.openUrl).toHaveBeenCalledWith("https://example.com");
  });
});
