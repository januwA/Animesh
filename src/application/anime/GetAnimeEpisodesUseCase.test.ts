import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimeEpisodesPage } from "@/domain/anime/AnimeSchemas";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";
import { GetAnimeEpisodesUseCase } from "./GetAnimeEpisodesUseCase";

describe("GetAnimeEpisodesUseCase 获取条目剧集列表", () => {
  const mockRepo = {
    getEpisodes: vi.fn(),
  } as unknown as AnimeRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该请求 Repository 并返回数据", async () => {
    const freshData: AnimeEpisodesPage = {
      items: [{ id: 1, name: "ep1", sort: 1 }],
      total: 150,
    };
    vi.mocked(mockRepo.getEpisodes).mockResolvedValueOnce(freshData as any);

    const useCase = new GetAnimeEpisodesUseCase(mockRepo);
    const result = await useCase.execute(Background, {
      subjectId: "1",
      offset: 50,
      limit: 50,
    });

    expect(mockRepo.getEpisodes).toHaveBeenCalledWith(Background, "1", 50, 50);
    expect(result).toEqual(freshData);
  });
});
