import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import type { BangumiSubjectSearchResult } from "../../domain/bangumi/BangumiSchemas";
import { SearchBangumiSubjectsUseCase } from "./SearchBangumiSubjectsUseCase";

describe("SearchBangumiSubjectsUseCase 搜索动漫条目", () => {
  const mockRepo = {
    searchSubjects: vi.fn(),
  } as unknown as BangumiRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应透传参数调用 Repository 并返回搜索结果", async () => {
    const params = { keyword: "间谍过家家", limit: 20, offset: 0 };
    const searchResult: BangumiSubjectSearchResult = {
      items: [
        {
          id: 1,
          name: "间谍过家家",
          summary: "",
          image: "",
          rating: 8.5,
          date: "2022-04-09",
          eps: 12,
          platform: "TV",
        },
      ],
      total: 1,
    };
    vi.mocked(mockRepo.searchSubjects).mockResolvedValueOnce(searchResult);

    const useCase = new SearchBangumiSubjectsUseCase(mockRepo);
    const result = await useCase.execute(Background, params);

    expect(mockRepo.searchSubjects).toHaveBeenCalledWith(Background, params);
    expect(result).toEqual(searchResult);
  });

  it("Repository 出错时应向上抛出错误", async () => {
    const error = new Error("network error");
    vi.mocked(mockRepo.searchSubjects).mockRejectedValueOnce(error);

    const useCase = new SearchBangumiSubjectsUseCase(mockRepo);

    await expect(
      useCase.execute(Background, { keyword: "xxx", limit: 20, offset: 0 }),
    ).rejects.toThrow(error);
  });
});
