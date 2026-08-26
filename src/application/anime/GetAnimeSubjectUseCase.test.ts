import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AnimeCache } from "../../domain/anime/AnimeCache";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";
import { GetAnimeSubjectUseCase } from "./GetAnimeSubjectUseCase";

describe("GetAnimeSubjectUseCase 获取条目信息", () => {
  const mockRepo = {
    getSubject: vi.fn(),
  } as unknown as AnimeRepository;

  const mockCache = {
    getSubject: vi.fn(),
    setSubject: vi.fn(),
  } as unknown as AnimeCache;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
    const cachedData: AnimeSubject = {
      id: 1,
      name: "cached",
      summary: "缓存",
      image: "",
      rating: 0,
    };
    vi.mocked(mockCache.getSubject).mockResolvedValueOnce(cachedData as any);

    const useCase = new GetAnimeSubjectUseCase(mockRepo, mockCache);
    const result = await useCase.execute(
      Background,
      NonEmptyStringSchema.parse("1"),
    );

    expect(mockCache.getSubject).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(mockRepo.getSubject).not.toHaveBeenCalled();
    expect(result).toEqual(cachedData);
  });

  it("应该在缓存未命中时请求 Repository 并写入缓存", async () => {
    const freshData: AnimeSubject = {
      id: 1,
      name: "fresh",
      summary: "新鲜",
      image: "",
      rating: 0,
    };
    vi.mocked(mockCache.getSubject).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getSubject).mockResolvedValueOnce(freshData as any);

    const useCase = new GetAnimeSubjectUseCase(mockRepo, mockCache);
    const result = await useCase.execute(
      Background,
      NonEmptyStringSchema.parse("1"),
    );

    expect(mockCache.getSubject).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(mockRepo.getSubject).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(mockCache.setSubject).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
      freshData,
    );
    expect(result).toEqual(freshData);
  });
});
