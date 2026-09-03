import { Background } from "ajanuw-context";
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
      platform: "bangumi" as const,
      name: "Name",
      imageUrl: null,
    };

    await useCase.execute(Background, item);

    expect(mockRepo.add).toHaveBeenCalled();
  });
});
