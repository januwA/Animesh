import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimeCache } from "../../domain/anime/AnimeCache";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";
import { GetAnimeCalendarUseCase } from "./GetAnimeCalendarUseCase";

describe("GetAnimeCalendarUseCase 获取新番日历", () => {
  const mockRepo = {
    getCalendar: vi.fn(),
  } as unknown as AnimeRepository;

  const mockCache = {
    getCalendar: vi.fn(),
    setCalendar: vi.fn(),
  } as unknown as AnimeCache;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
    const cachedData = [
      {
        weekday: { id: 1 },
        items: [
          { id: 2, name: "高分", rating: 9.0 },
          { id: 1, name: "低分", rating: 4.0 },
        ] as any,
      },
    ];
    vi.mocked(mockCache.getCalendar).mockResolvedValueOnce(cachedData);

    const useCase = new GetAnimeCalendarUseCase(mockRepo, mockCache);
    const results = await useCase.execute(Background);

    expect(mockCache.getCalendar).toHaveBeenCalledWith(Background);
    expect(mockRepo.getCalendar).not.toHaveBeenCalled();
    expect(results).toEqual(cachedData);
  });

  it("应该在缓存未命中时请求 Repository 并写入缓存", async () => {
    const freshData = [
      {
        weekday: { id: 1, en: "Monday", cn: "星期一", ja: "月曜日" },
        items: [{ id: 101, name: "Anime Monday", rating: 7.5 } as any],
      },
    ];
    vi.mocked(mockCache.getCalendar).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getCalendar).mockResolvedValueOnce(freshData);

    const useCase = new GetAnimeCalendarUseCase(mockRepo, mockCache);
    const results = await useCase.execute(Background);

    expect(mockCache.getCalendar).toHaveBeenCalledWith(Background);
    expect(mockRepo.getCalendar).toHaveBeenCalledWith(Background);
    expect(mockCache.setCalendar).toHaveBeenCalledWith(Background, freshData);
    expect(results).toEqual(freshData);
  });

  it("应该在缓存未命中时对每个星期的 items 按 rating 降序排序，rating 为 0 排在最后", async () => {
    const freshData = [
      {
        weekday: { id: 1 },
        items: [
          { id: 1, name: "高分", rating: 9.2 },
          { id: 2, name: "零分", rating: 0 },
          { id: 3, name: "中分", rating: 7.8 },
        ] as any,
      },
      {
        weekday: { id: 2 },
        items: [
          { id: 4, name: "A", rating: 8.5 },
          { id: 5, name: "B", rating: 0 },
        ] as any,
      },
    ];
    vi.mocked(mockCache.getCalendar).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getCalendar).mockResolvedValueOnce(freshData);

    const useCase = new GetAnimeCalendarUseCase(mockRepo, mockCache);
    const results = await useCase.execute(Background);

    expect(results[0].items.map((i: { rating: number }) => i.rating)).toEqual([
      9.2, 7.8, 0,
    ]);
    expect(results[1].items.map((i: { rating: number }) => i.rating)).toEqual([
      8.5, 0,
    ]);
  });

  it("不应该修改原始数据", async () => {
    const freshData = [
      {
        weekday: { id: 1 },
        items: [
          { id: 1, name: "A", rating: 3.0 },
          { id: 2, name: "B", rating: 8.0 },
        ] as any,
      },
    ];
    vi.mocked(mockCache.getCalendar).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getCalendar).mockResolvedValueOnce(freshData);

    const useCase = new GetAnimeCalendarUseCase(mockRepo, mockCache);
    await useCase.execute(Background);

    expect(freshData[0].items.map((i: { rating: number }) => i.rating)).toEqual(
      [3.0, 8.0],
    );
  });
});
