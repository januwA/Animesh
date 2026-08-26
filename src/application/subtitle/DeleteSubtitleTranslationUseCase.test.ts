import { describe, expect, it, vi } from "vitest";
import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import { DeleteSubtitleTranslationUseCase } from "./DeleteSubtitleTranslationUseCase";

describe("DeleteSubtitleTranslationUseCase", () => {
  it("应该调用仓储的 deleteById 方法并返回删除结果", async () => {
    const mockRepo: SubtitleTranslationRepository = {
      getById: vi.fn(),
      listByTorrent: vi.fn(),
      save: vi.fn(),
      deleteById: vi.fn().mockResolvedValue(true),
      deleteByTorrent: vi.fn(),
      deleteByInfoHash: vi.fn(),
    };

    const useCase = new DeleteSubtitleTranslationUseCase(mockRepo);
    const result = await useCase.execute("sub-123");

    expect(mockRepo.deleteById).toHaveBeenCalledWith("sub-123");
    expect(result).toBe(true);
  });
});
