import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
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

    await useCase.execute(NonEmptyStringSchema.parse("https://example.com"));

    expect(rawMockRepo.openUrl).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("https://example.com"),
    );
  });
});
