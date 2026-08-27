import { Background } from "ajanuw-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import type { AnimeCache } from "../../domain/anime/AnimeCache";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";
import {
  GetNextSeasonAnimeUseCase,
  getNextSeasonInfo,
} from "./GetNextSeasonAnimeUseCase";

function makeSubject(
  overrides: Partial<AnimeSubject> & { id: number },
): AnimeSubject {
  return {
    name: `Test Anime ${overrides.id}`,
    image: `https://img.example/${overrides.id}.jpg`,
    rating: 8,
    summary: "",
    date: "2026-10-01",
    ...overrides,
  };
}

describe("GetNextSeasonAnimeUseCase 获取下季度新番", () => {
  const mockRepo = {
    getNextSeasonSubjects: vi.fn(),
  } as unknown as AnimeRepository;

  const mockCache = {
    getNextSeason: vi.fn(),
    setNextSeason: vi.fn(),
  } as unknown as AnimeCache;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("缓存命中时直接返回缓存数据且不请求 Repository", async () => {
    const cached = [makeSubject({ id: 1, date: "2026-10-01" })];
    vi.mocked(mockCache.getNextSeason).mockResolvedValueOnce(cached);

    const useCase = new GetNextSeasonAnimeUseCase(mockRepo, mockCache);
    const result = await useCase.execute(Background);

    expect(mockCache.getNextSeason).toHaveBeenCalledWith(
      Background,
      2026,
      [10, 11, 12],
    );
    expect(mockRepo.getNextSeasonSubjects).not.toHaveBeenCalled();
    expect(result.info.year).toBe(2026);
    expect(result.info.season).toBe("秋");
    expect(result.data).toHaveLength(3);
    expect(result.data[0].items).toHaveLength(1);
  });

  it("缓存未命中时请求 Repository 并写入缓存", async () => {
    const subjects = [
      makeSubject({ id: 1, date: "2026-10-01" }),
      makeSubject({ id: 2, date: "2026-11-15" }),
      makeSubject({ id: 3, date: "2026-12-20" }),
    ];
    vi.mocked(mockCache.getNextSeason).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getNextSeasonSubjects).mockResolvedValueOnce(subjects);

    const useCase = new GetNextSeasonAnimeUseCase(mockRepo, mockCache);
    const result = await useCase.execute(Background);

    expect(mockRepo.getNextSeasonSubjects).toHaveBeenCalledWith(
      Background,
      2026,
      [10, 11, 12],
    );
    expect(mockCache.setNextSeason).toHaveBeenCalledWith(
      Background,
      2026,
      [10, 11, 12],
      subjects,
    );
    expect(result.data[0].items).toHaveLength(1);
    expect(result.data[0].items[0].id).toBe(1);
    expect(result.data[1].items).toHaveLength(1);
    expect(result.data[1].items[0].id).toBe(2);
    expect(result.data[2].items).toHaveLength(1);
    expect(result.data[2].items[0].id).toBe(3);
  });

  it("按月份正确分组且同月去重", async () => {
    const subjects = [
      makeSubject({ id: 1, date: "2026-10-01" }),
      makeSubject({ id: 2, date: "2026-10-15" }),
      makeSubject({ id: 1, date: "2026-10-01" }),
    ];
    vi.mocked(mockCache.getNextSeason).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getNextSeasonSubjects).mockResolvedValueOnce(subjects);

    const useCase = new GetNextSeasonAnimeUseCase(mockRepo, mockCache);
    const result = await useCase.execute(Background);

    expect(result.data[0].items).toHaveLength(2);
  });

  it("无日期的条目应被跳过", async () => {
    const subjects = [
      makeSubject({ id: 1, date: "2026-10-01" }),
      makeSubject({ id: 2, date: null }),
      makeSubject({ id: 3 }),
    ];
    delete subjects[2].date;
    vi.mocked(mockCache.getNextSeason).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getNextSeasonSubjects).mockResolvedValueOnce(subjects);

    const useCase = new GetNextSeasonAnimeUseCase(mockRepo, mockCache);
    const result = await useCase.execute(Background);

    expect(result.data[0].items).toHaveLength(1);
    expect(result.data[0].items[0].id).toBe(1);
  });

  it("日期格式不匹配正则时应跳过该条目", async () => {
    const subjects = [
      makeSubject({ id: 1, date: "2026-10-01" }),
      makeSubject({ id: 2, date: "bad-date" }),
    ];
    vi.mocked(mockCache.getNextSeason).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getNextSeasonSubjects).mockResolvedValueOnce(subjects);

    const useCase = new GetNextSeasonAnimeUseCase(mockRepo, mockCache);
    const result = await useCase.execute(Background);

    expect(result.data[0].items).toHaveLength(1);
    expect(result.data[0].items[0].id).toBe(1);
  });

  it("日期月份不在当前季度范围内时应跳过该条目", async () => {
    const subjects = [
      makeSubject({ id: 1, date: "2026-10-01" }),
      makeSubject({ id: 2, date: "2026-06-15" }),
    ];
    vi.mocked(mockCache.getNextSeason).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getNextSeasonSubjects).mockResolvedValueOnce(subjects);

    const useCase = new GetNextSeasonAnimeUseCase(mockRepo, mockCache);
    const result = await useCase.execute(Background);

    expect(result.data[0].items).toHaveLength(1);
    expect(result.data[0].items[0].id).toBe(1);
    expect(result.data[1].items).toHaveLength(0);
  });

  it("Repository 出错时应向上抛出错误且不写缓存", async () => {
    vi.mocked(mockCache.getNextSeason).mockResolvedValueOnce(null);
    vi.mocked(mockRepo.getNextSeasonSubjects).mockRejectedValueOnce(
      new Error("network error"),
    );

    const useCase = new GetNextSeasonAnimeUseCase(mockRepo, mockCache);
    const promise = useCase.execute(Background);

    await expect(promise).rejects.toThrow("network error");
    expect(mockCache.setNextSeason).not.toHaveBeenCalled();
  });
});

describe("getNextSeasonInfo 季度计算", () => {
  it("1-3月应返回春季", () => {
    expect(getNextSeasonInfo(new Date(2026, 0, 15))).toEqual({
      year: 2026,
      season: "春",
      months: [4, 5, 6],
    });
  });

  it("4-6月应返回夏季", () => {
    expect(getNextSeasonInfo(new Date(2026, 3, 15))).toEqual({
      year: 2026,
      season: "夏",
      months: [7, 8, 9],
    });
  });

  it("7-9月应返回秋季", () => {
    expect(getNextSeasonInfo(new Date(2026, 7, 15))).toEqual({
      year: 2026,
      season: "秋",
      months: [10, 11, 12],
    });
  });

  it("10-12月应返回次年冬季", () => {
    expect(getNextSeasonInfo(new Date(2026, 10, 15))).toEqual({
      year: 2027,
      season: "冬",
      months: [1, 2, 3],
    });
  });
});
