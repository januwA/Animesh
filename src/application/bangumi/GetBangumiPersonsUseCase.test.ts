import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { BangumiCache } from "../../domain/bangumi/BangumiCache";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import { GetBangumiPersonsUseCase } from "./GetBangumiPersonsUseCase";

describe("GetBangumiPersonsUseCase 获取条目制作人员", () => {
  const mockRepo = {
    getSubjectPersons: vi.fn(),
  } as unknown as BangumiRepository;

  const mockCache = {
    getPersons: vi.fn(),
    setPersons: vi.fn(),
  } as unknown as BangumiCache;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
    const cachedData = [
      {
        id: 1,
        name: "person1",
        relation: "导演",
        career: ["导演"],
        type: 1,
        eps: "1-12",
        images: { small: "", grid: "", large: "", medium: "" },
      },
    ];
    vi.mocked(mockCache.getPersons).mockResolvedValueOnce(cachedData as any);

    const useCase = new GetBangumiPersonsUseCase(mockRepo, mockCache);
    const result = await useCase.execute(
      Background,
      NonEmptyStringSchema.parse("1"),
    );

    expect(mockCache.getPersons).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(mockRepo.getSubjectPersons).not.toHaveBeenCalled();
    expect(result).toEqual(cachedData);
  });

  it("应该在缓存未命中时请求 Repository 并写入缓存", async () => {
    const freshData = [
      {
        id: 1,
        name: "person1",
        relation: "导演",
        career: ["导演"],
        type: 1,
        eps: "1-12",
        images: { small: "", grid: "", large: "", medium: "" },
      },
    ];
    vi.mocked(mockCache.getPersons).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getSubjectPersons).mockResolvedValueOnce(
      freshData as any,
    );

    const useCase = new GetBangumiPersonsUseCase(mockRepo, mockCache);
    const result = await useCase.execute(
      Background,
      NonEmptyStringSchema.parse("1"),
    );

    expect(mockCache.getPersons).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(mockRepo.getSubjectPersons).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(mockCache.setPersons).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
      freshData,
    );
    expect(result).toEqual(freshData);
  });
});
