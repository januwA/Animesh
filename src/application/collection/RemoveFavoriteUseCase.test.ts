import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import { RemoveFavoriteUseCase } from "./RemoveFavoriteUseCase";

describe("RemoveFavoriteUseCase 移除收藏", () => {
  const mockRepo = {
    remove: vi.fn(),
  } as unknown as CollectionRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该使用 subjectId 调用 repo.remove()", async () => {
    const useCase = new RemoveFavoriteUseCase(mockRepo);
    await useCase.execute(101);

    expect(mockRepo.remove).toHaveBeenCalledWith(101);
  });
});
