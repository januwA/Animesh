import { Background } from "ajanuw-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BangumiCache } from "../../domain/bangumi/BangumiCache";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import {
  GetBangumiRankedSubjectsUseCase,
  RANKED_SUBJECT_LIMIT,
  RANKED_SUBJECT_MONTH_WINDOW,
  recentMonthWindows,
} from "./GetBangumiRankedSubjectsUseCase";

const rankedSubject = {
  id: 326,
  name: "新世纪福音战士",
  image: "https://img.example/l.jpg",
  rating: 9.1,
  rank: 1,
};

const currentMonthSubject = { ...rankedSubject, id: 101 };
const lastMonthSubject = { ...rankedSubject, id: 202 };

describe("GetBangumiRankedSubjectsUseCase 获取榜单条目", () => {
  const mockRepo = {
    getRankedSubjects: vi.fn(),
  } as unknown as BangumiRepository;

  const mockCache = {
    getRankedSubjects: vi.fn(),
    setRankedSubjects: vi.fn(),
  } as unknown as BangumiCache;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("缓存命中时直接返回缓存数据且不请求 Repository", async () => {
    vi.mocked(mockCache.getRankedSubjects).mockResolvedValueOnce([
      rankedSubject,
    ]);

    const useCase = new GetBangumiRankedSubjectsUseCase(mockRepo, mockCache);
    const results = await useCase.execute(Background);

    expect(mockCache.getRankedSubjects).toHaveBeenCalledWith(Background);
    expect(mockRepo.getRankedSubjects).not.toHaveBeenCalled();
    expect(results).toEqual([rankedSubject]);
  });

  it("缓存未命中时按本月与上月分别请求并合并后写入缓存", async () => {
    vi.mocked(mockCache.getRankedSubjects).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getRankedSubjects)
      .mockResolvedValueOnce([currentMonthSubject])
      .mockResolvedValueOnce([lastMonthSubject]);

    const useCase = new GetBangumiRankedSubjectsUseCase(mockRepo, mockCache);
    const results = await useCase.execute(Background);

    expect(mockRepo.getRankedSubjects).toHaveBeenNthCalledWith(
      1,
      Background,
      2026,
      8,
      RANKED_SUBJECT_LIMIT,
    );
    expect(mockRepo.getRankedSubjects).toHaveBeenNthCalledWith(
      2,
      Background,
      2026,
      7,
      RANKED_SUBJECT_LIMIT,
    );
    expect(mockCache.setRankedSubjects).toHaveBeenCalledWith(Background, [
      currentMonthSubject,
      lastMonthSubject,
    ]);
    expect(results).toEqual([currentMonthSubject, lastMonthSubject]);
  });

  it("任一月份请求失败时向上抛出错误且不写缓存", async () => {
    vi.mocked(mockCache.getRankedSubjects).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getRankedSubjects)
      .mockResolvedValueOnce([currentMonthSubject])
      .mockRejectedValueOnce(new Error("network error"));

    const useCase = new GetBangumiRankedSubjectsUseCase(mockRepo, mockCache);
    const promise = useCase.execute(Background);

    await expect(promise).rejects.toThrow("network error");
    expect(mockCache.setRankedSubjects).not.toHaveBeenCalled();
  });
});

describe("recentMonthWindows 月份窗口", () => {
  it("年中时返回本月与上月", () => {
    expect(
      recentMonthWindows(RANKED_SUBJECT_MONTH_WINDOW, new Date(2026, 7, 15)),
    ).toEqual([
      { year: 2026, month: 8 },
      { year: 2026, month: 7 },
    ]);
  });

  it("1 月时上月跨年回绕到上一年的 12 月", () => {
    expect(
      recentMonthWindows(RANKED_SUBJECT_MONTH_WINDOW, new Date(2026, 0, 15)),
    ).toEqual([
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
    ]);
  });
});
