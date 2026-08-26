import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import { GetFavoriteStatusUseCase } from "./GetFavoriteStatusUseCase";

describe("GetFavoriteStatusUseCase 查询收藏状态", () => {
  const mockRepo = {
    isFavorited: vi.fn(),
  } as unknown as CollectionRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("当条目已被收藏时应该返回 true", async () => {
    vi.mocked(mockRepo.isFavorited).mockResolvedValue(true);

    const useCase = new GetFavoriteStatusUseCase(mockRepo);
    const result = await useCase.execute(101, "bangumi");

    expect(result).toBe(true);
    expect(mockRepo.isFavorited).toHaveBeenCalledWith(101, "bangumi");
  });

  it("当条目未被收藏时应该返回 false", async () => {
    vi.mocked(mockRepo.isFavorited).mockResolvedValue(false);

    const useCase = new GetFavoriteStatusUseCase(mockRepo);
    const result = await useCase.execute(101, "anilist");

    expect(result).toBe(false);
    expect(mockRepo.isFavorited).toHaveBeenCalledWith(101, "anilist");
  });
});
