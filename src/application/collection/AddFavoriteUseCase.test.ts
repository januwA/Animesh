import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import { AddFavoriteUseCase } from "./AddFavoriteUseCase";

describe("AddFavoriteUseCase 添加收藏", () => {
  const mockRepo = {
    add: vi.fn(),
  } as unknown as CollectionRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该添加收藏条目", async () => {
    const useCase = new AddFavoriteUseCase(mockRepo);
    const item = {
      subjectId: 101,
      name: "Name",
      nameCn: "名称",
      imageUrl: null,
      rating: null,
      platform: null,
      date: null,
      summary: null,
    };

    await useCase.execute(item);

    expect(mockRepo.add).toHaveBeenCalledWith(item);
  });
});
