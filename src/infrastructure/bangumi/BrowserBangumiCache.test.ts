import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { CacheStore } from "@/infrastructure/storage/CacheStore";
import {
  BangumiCalendarStoredSchema,
  BangumiCharactersStoredSchema,
  BangumiEpisodesPageStoredSchema,
  BangumiPersonsStoredSchema,
  BangumiRankedSubjectsStoredSchema,
  BangumiSubjectSchema,
  BangumiSubjectStoredSchema,
} from "./BangumiSchemas";
import { BrowserBangumiCache } from "./BrowserBangumiCache";

const images = {
  large: "https://img.example/l.jpg",
  medium: "https://img.example/m.jpg",
  small: "https://img.example/s.jpg",
  grid: "https://img.example/g.jpg",
};

const rawSubject = {
  id: 1,
  name: "Anime",
  name_cn: "动画",
  summary: "简介",
  images,
  rating: { score: 8.5, rank: 5, total: 10 },
  collection: { wish: 1, collect: 2, doing: 3, on_hold: 4, dropped: 5 },
  date: "2026-01-01",
  eps: 12,
  platform: "TV",
};

/** 模拟 IndexedDbCacheStore 的 envelope+TTL+schema 校验语义的内存缓存 */
function createMemoryCacheStore(): CacheStore {
  const map = new Map<string, { data: unknown; expiry: number }>();
  return {
    async getItem<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
      const entry = map.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiry) {
        map.delete(key);
        return null;
      }
      const result = schema.safeParse(entry.data);
      if (!result.success) {
        map.delete(key);
        return null;
      }
      return result.data;
    },
    async setItem<T>(key: string, data: T, ttlMs: number): Promise<void> {
      map.set(key, { data, expiry: Date.now() + ttlMs });
    },
    async removeItem(key: string): Promise<void> {
      map.delete(key);
    },
    async clear(): Promise<void> {
      map.clear();
    },
  };
}

describe("BrowserBangumiCache 缓存读取", () => {
  const store = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  } as unknown as CacheStore;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getCalendar 应使用存储形状 Schema 校验", () => {
    vi.mocked(store.getItem).mockResolvedValueOnce(null);
    const cache = new BrowserBangumiCache(store);

    void cache.getCalendar(Background);

    expect(store.getItem).toHaveBeenCalledWith(
      "bangumi:calendar",
      BangumiCalendarStoredSchema,
    );
  });

  it("getSubject 应使用存储形状 Schema 校验", () => {
    vi.mocked(store.getItem).mockResolvedValueOnce(null);
    const cache = new BrowserBangumiCache(store);
    const id = NonEmptyStringSchema.parse("1");

    void cache.getSubject(Background, id);

    expect(store.getItem).toHaveBeenCalledWith(
      `bangumi:subject:${id}`,
      BangumiSubjectStoredSchema,
    );
  });

  it("getEpisodes 应使用存储形状 Schema 校验", () => {
    vi.mocked(store.getItem).mockResolvedValueOnce(null);
    const cache = new BrowserBangumiCache(store);
    const id = NonEmptyStringSchema.parse("1");

    void cache.getEpisodes(Background, id, 0, 20);

    expect(store.getItem).toHaveBeenCalledWith(
      `bangumi:episodes:${id}:0:20`,
      BangumiEpisodesPageStoredSchema,
    );
  });

  it("getPersons 应使用存储形状 Schema 校验", () => {
    vi.mocked(store.getItem).mockResolvedValueOnce(null);
    const cache = new BrowserBangumiCache(store);
    const id = NonEmptyStringSchema.parse("1");

    void cache.getPersons(Background, id);

    expect(store.getItem).toHaveBeenCalledWith(
      `bangumi:persons:${id}`,
      BangumiPersonsStoredSchema,
    );
  });

  it("getCharacters 应使用存储形状 Schema 校验", () => {
    vi.mocked(store.getItem).mockResolvedValueOnce(null);
    const cache = new BrowserBangumiCache(store);
    const id = NonEmptyStringSchema.parse("1");

    void cache.getCharacters(Background, id);

    expect(store.getItem).toHaveBeenCalledWith(
      `bangumi:characters:${id}`,
      BangumiCharactersStoredSchema,
    );
  });

  it("getRankedSubjects 应使用存储形状 Schema 校验", () => {
    vi.mocked(store.getItem).mockResolvedValueOnce(null);
    const cache = new BrowserBangumiCache(store);

    void cache.getRankedSubjects(Background);

    expect(store.getItem).toHaveBeenCalledWith(
      "bangumi:ranked-subjects",
      BangumiRankedSubjectsStoredSchema,
    );
  });

  it("setRankedSubjects 应写入榜单缓存", async () => {
    const cache = new BrowserBangumiCache(createMemoryCacheStore());
    const ranked = BangumiSubjectSchema.parse({
      id: 326,
      name: "Shin Seiki Evangelion",
      name_cn: "新世纪福音战士",
      images,
      rating: { score: 9.1, rank: 1 },
    });

    await cache.setRankedSubjects(Background, [ranked]);
    const read = await cache.getRankedSubjects(Background);

    expect(read).toEqual([ranked]);
  });

  it("条目写入后再次读取应命中缓存而非返回 null", async () => {
    const cache = new BrowserBangumiCache(createMemoryCacheStore());
    const subject = BangumiSubjectSchema.parse(rawSubject);
    const id = NonEmptyStringSchema.parse("1");

    await cache.setSubject(Background, id, subject);
    const read = await cache.getSubject(Background, id);

    expect(read).toEqual(subject);
  });
});
