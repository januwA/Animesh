import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimeEpisodesPage } from "@/domain/anime/AnimeSchemas";
import type { AnimeCache } from "../../domain/anime/AnimeCache";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";
import { GetAnimeEpisodesUseCase } from "./GetAnimeEpisodesUseCase";

describe("GetAnimeEpisodesUseCase 获取条目剧集列表", () => {
  const mockRepo = {
    getEpisodes: vi.fn(),
  } as unknown as AnimeRepository;

  const mockCache = {
    getEpisodes: vi.fn(),
    setEpisodes: vi.fn(),
  } as unknown as AnimeCache;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
    const cachedData: AnimeEpisodesPage = {
      items: [{ id: 1, name: "ep1", sort: 1 }],
      total: 150,
    };
    vi.mocked(mockCache.getEpisodes).mockResolvedValueOnce(cachedData as any);

    const useCase = new GetAnimeEpisodesUseCase(mockRepo, mockCache);
    const result = await useCase.execute(Background, {
      subjectId: "1",
      offset: 50,
      limit: 50,
    });

    expect(mockCache.getEpisodes).toHaveBeenCalledWith(Background, "1", 50, 50);
    expect(mockRepo.getEpisodes).not.toHaveBeenCalled();
    expect(result).toEqual(cachedData);
  });

  it("应该在缓存未命中时请求 Repository 并写入缓存", async () => {
    const freshData: AnimeEpisodesPage = {
      items: [{ id: 1, name: "ep1", sort: 1 }],
      total: 150,
    };
    vi.mocked(mockCache.getEpisodes).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getEpisodes).mockResolvedValueOnce(freshData as any);

    const useCase = new GetAnimeEpisodesUseCase(mockRepo, mockCache);
    const result = await useCase.execute(Background, {
      subjectId: "1",
      offset: 50,
      limit: 50,
    });

    expect(mockCache.getEpisodes).toHaveBeenCalledWith(Background, "1", 50, 50);
    expect(mockRepo.getEpisodes).toHaveBeenCalledWith(Background, "1", 50, 50);
    expect(mockCache.setEpisodes).toHaveBeenCalledWith(
      Background,
      "1",
      50,
      50,
      freshData,
    );
    expect(result).toEqual(freshData);
  });
});
