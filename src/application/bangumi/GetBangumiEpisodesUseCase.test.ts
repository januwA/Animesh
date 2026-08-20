import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BangumiEpisodesPage } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiCache } from "../../domain/bangumi/BangumiCache";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import { GetBangumiEpisodesUseCase } from "./GetBangumiEpisodesUseCase";

describe("GetBangumiEpisodesUseCase 获取条目剧集列表", () => {
  const mockRepo = {
    getEpisodes: vi.fn(),
  } as unknown as BangumiRepository;

  const mockCache = {
    getEpisodes: vi.fn(),
    setEpisodes: vi.fn(),
  } as unknown as BangumiCache;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
    const cachedData: BangumiEpisodesPage = {
      items: [{ id: 1, name: "ep1", sort: 1, type: 0 }],
      total: 150,
    };
    vi.mocked(mockCache.getEpisodes).mockResolvedValueOnce(cachedData as any);

    const useCase = new GetBangumiEpisodesUseCase(mockRepo, mockCache);
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
    const freshData: BangumiEpisodesPage = {
      items: [{ id: 1, name: "ep1", sort: 1, type: 0 }],
      total: 150,
    };
    vi.mocked(mockCache.getEpisodes).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getEpisodes).mockResolvedValueOnce(freshData as any);

    const useCase = new GetBangumiEpisodesUseCase(mockRepo, mockCache);
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
