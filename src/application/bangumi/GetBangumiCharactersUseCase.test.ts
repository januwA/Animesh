import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { BangumiCache } from "../../domain/bangumi/BangumiCache";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import { GetBangumiCharactersUseCase } from "./GetBangumiCharactersUseCase";

describe("GetBangumiCharactersUseCase 获取条目角色", () => {
  const mockRepo = {
    getSubjectCharacters: vi.fn(),
  } as unknown as BangumiRepository;

  const mockCache = {
    getCharacters: vi.fn(),
    setCharacters: vi.fn(),
  } as unknown as BangumiCache;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
    const cachedData = [
      {
        id: 1,
        name: "char1",
        relation: "主角",
        type: 1,
        summary: "desc",
        images: { small: "", grid: "", large: "", medium: "" },
        actors: [],
      },
    ];
    vi.mocked(mockCache.getCharacters).mockResolvedValueOnce(cachedData as any);

    const useCase = new GetBangumiCharactersUseCase(mockRepo, mockCache);
    const result = await useCase.execute(
      Background,
      NonEmptyStringSchema.parse("1"),
    );

    expect(mockCache.getCharacters).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(mockRepo.getSubjectCharacters).not.toHaveBeenCalled();
    expect(result).toEqual(cachedData);
  });

  it("应该在缓存未命中时请求 Repository 并写入缓存", async () => {
    const freshData = [
      {
        id: 1,
        name: "char1",
        relation: "主角",
        type: 1,
        summary: "desc",
        images: { small: "", grid: "", large: "", medium: "" },
        actors: [],
      },
    ];
    vi.mocked(mockCache.getCharacters).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getSubjectCharacters).mockResolvedValueOnce(
      freshData as any,
    );

    const useCase = new GetBangumiCharactersUseCase(mockRepo, mockCache);
    const result = await useCase.execute(
      Background,
      NonEmptyStringSchema.parse("1"),
    );

    expect(mockCache.getCharacters).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(mockRepo.getSubjectCharacters).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(mockCache.setCharacters).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
      freshData,
    );
    expect(result).toEqual(freshData);
  });
});
