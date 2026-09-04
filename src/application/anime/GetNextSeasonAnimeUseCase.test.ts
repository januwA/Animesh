import { Background } from "ajanuw-context";
import { describe, expect, it, vi } from "vitest";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";
import {
  GetNextSeasonAnimeUseCase,
  getNextSeasonInfo,
} from "./GetNextSeasonAnimeUseCase";

describe("GetNextSeasonAnimeUseCase 获取下季度新番", () => {
  it("execute 应该调用 repository.getNextSeasonSubjects 并返回分页结果", async () => {
    const mockRepo = {
      getNextSeasonSubjects: vi.fn().mockResolvedValue({
        items: [{ id: 1, name: "测试新番", rating: 8, image: "" }],
        hasNextPage: true,
      }),
    } as unknown as AnimeRepository;

    const useCase = new GetNextSeasonAnimeUseCase(mockRepo);
    const params = { year: 2026, month: 10, limit: 20, offset: 0 };
    const result = await useCase.execute(Background, params);

    expect(mockRepo.getNextSeasonSubjects).toHaveBeenCalledWith(
      Background,
      params,
    );
    expect(result.items).toHaveLength(1);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getNextSeasonInfo 季度计算", () => {
  it("1-3月应返回春季", () => {
    expect(getNextSeasonInfo(new Date(2026, 0, 15))).toEqual({
      year: 2026,
      season: "春",
      months: [4, 5, 6],
      tabs: [
        { month: 4, label: "4月" },
        { month: 5, label: "5月" },
        { month: 6, label: "6月" },
      ],
    });
  });

  it("4-6月应返回夏季", () => {
    expect(getNextSeasonInfo(new Date(2026, 3, 15))).toEqual({
      year: 2026,
      season: "夏",
      months: [7, 8, 9],
      tabs: [
        { month: 7, label: "7月" },
        { month: 8, label: "8月" },
        { month: 9, label: "9月" },
      ],
    });
  });

  it("7-9月应返回秋季", () => {
    expect(getNextSeasonInfo(new Date(2026, 7, 15))).toEqual({
      year: 2026,
      season: "秋",
      months: [10, 11, 12],
      tabs: [
        { month: 10, label: "10月" },
        { month: 11, label: "11月" },
        { month: 12, label: "12月" },
      ],
    });
  });

  it("10-12月应返回次年冬季", () => {
    expect(getNextSeasonInfo(new Date(2026, 10, 15))).toEqual({
      year: 2027,
      season: "冬",
      months: [1, 2, 3],
      tabs: [
        { month: 1, label: "1月" },
        { month: 2, label: "2月" },
        { month: 3, label: "3月" },
      ],
    });
  });
});
