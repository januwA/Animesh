import { Background } from "ajanuw-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";
import {
  GetWallpaperImagesUseCase,
  RANKED_SUBJECT_LIMIT,
  recentMonthWindows,
} from "./GetWallpaperImagesUseCase";

const rankedSubject: AnimeSubject = {
  id: 326,
  name: "新世纪福音战士",
  image: "https://img.example/l.jpg",
  rating: 9.1,
  summary: "",
};

function paged(
  items: AnimeSubject[],
  total?: number,
): { items: AnimeSubject[]; total: number } {
  return { items, total: total ?? items.length };
}

describe("GetWallpaperImagesUseCase 获取壁纸图片", () => {
  const mockRepo = {
    getRankedSubjects: vi.fn(),
  } as unknown as AnimeRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("按本月与上月分别请求并合并后返回", async () => {
    const current = [{ ...rankedSubject, id: 1, rating: 8 }];
    const last = [{ ...rankedSubject, id: 2, rating: 9 }];

    vi.mocked(mockRepo.getRankedSubjects)
      .mockResolvedValueOnce(paged(current))
      .mockResolvedValueOnce(paged(last));

    const useCase = new GetWallpaperImagesUseCase(mockRepo);
    const results = await useCase.execute(Background);

    expect(mockRepo.getRankedSubjects).toHaveBeenNthCalledWith(1, Background, {
      month: 8,
      sort: "rank",
      year: 2026,
    });
    expect(mockRepo.getRankedSubjects).toHaveBeenNthCalledWith(2, Background, {
      month: 7,
      sort: "rank",
      year: 2026,
    });
    expect(results).toEqual([...current, ...last]);
  });

  it("合并结果超过 RANKED_SUBJECT_LIMIT 时仅保留前 RANKED_SUBJECT_LIMIT 条", async () => {
    const items = Array.from({ length: RANKED_SUBJECT_LIMIT + 5 }, (_, i) => ({
      ...rankedSubject,
      id: i + 1,
    }));

    vi.mocked(mockRepo.getRankedSubjects)
      .mockResolvedValueOnce(paged(items.slice(0, RANKED_SUBJECT_LIMIT)))
      .mockResolvedValueOnce(paged(items.slice(RANKED_SUBJECT_LIMIT)));

    const useCase = new GetWallpaperImagesUseCase(mockRepo);
    const results = await useCase.execute(Background);

    expect(results).toHaveLength(RANKED_SUBJECT_LIMIT);
  });

  it("任一月份请求失败时向上抛出错误", async () => {
    vi.mocked(mockRepo.getRankedSubjects)
      .mockResolvedValueOnce(paged([rankedSubject]))
      .mockRejectedValueOnce(new Error("network error"));

    const useCase = new GetWallpaperImagesUseCase(mockRepo);
    const promise = useCase.execute(Background);

    await expect(promise).rejects.toThrow("network error");
  });
});

describe("recentMonthWindows 月份窗口", () => {
  it("年中时返回本月与上月", () => {
    expect(recentMonthWindows(2, new Date(2026, 7, 15))).toEqual([
      { year: 2026, month: 8 },
      { year: 2026, month: 7 },
    ]);
  });

  it("1 月时上月跨年回绕到上一年的 12 月", () => {
    expect(recentMonthWindows(2, new Date(2026, 0, 15))).toEqual([
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
    ]);
  });
});
