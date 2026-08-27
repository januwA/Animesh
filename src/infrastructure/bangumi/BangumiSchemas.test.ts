import { describe, expect, it } from "vitest";
import {
  AnimeCalendarStoredSchema,
  AnimeCharactersStoredSchema,
  AnimeEpisodesPageStoredSchema,
  AnimePersonsStoredSchema,
  AnimeRankedSubjectsStoredSchema,
  AnimeSubjectStoredSchema,
} from "@/infrastructure/animeStoredSchemas";
import {
  BangumiCalendarResponseSchema,
  BangumiCharactersResponseSchema,
  BangumiEpisodesResponseSchema,
  BangumiPersonsResponseSchema,
  BangumiRankedSubjectsResponseSchema,
  BangumiSubjectSchema,
  BangumiSubjectSearchResponseSchema,
} from "./BangumiSchemas";

const weekday = { en: "Monday", cn: "星期一", ja: "月曜日", id: 1 };
const images = {
  large: "https://img.example/l.jpg",
  medium: "https://img.example/m.jpg",
  small: "https://img.example/s.jpg",
  grid: "https://img.example/g.jpg",
};

const rawCalendarItem = {
  id: 101,
  url: "https://bgm.tv/subject/101",
  name: "Anime",
  name_cn: "动画",
  air_date: "2026-01-01",
  air_weekday: 1,
  rating: { total: 10, score: 8.5 },
  rank: 5,
  images,
  collection: { doing: 1 },
};

const rawCalendar = [{ weekday, items: [rawCalendarItem] }];

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

const rawEpisode = {
  id: 301,
  type: 0,
  sort: 1,
  name: "Episode 1",
  name_cn: "第1集",
  duration: "24m",
  airdate: "2026-01-07",
  desc: "描述",
};

const rawPerson = {
  id: 501,
  name: "导演",
  relation: "导演",
  career: ["动画"],
  type: 1,
  eps: "1-12",
  images,
};

const rawActor = {
  id: 601,
  name: "声优",
  images,
  short_summary: "简介",
  career: ["配音"],
  type: 1,
  locked: true,
};

const rawCharacter = {
  id: 701,
  name: "角色",
  images,
  summary: "简介",
  relation: "主角",
  type: 1,
  actors: [rawActor],
};

describe("Bangumi 条目搜索 Schema", () => {
  it("搜索响应经 transform 后仅保留表现层所需字段", () => {
    const rawPage = {
      total: 1,
      limit: 20,
      offset: 0,
      data: [rawSubject],
    };

    const result = BangumiSubjectSearchResponseSchema.parse(rawPage);

    expect(result).toEqual({
      items: [
        {
          id: 1,
          name: "动画",
          summary: "简介",
          image: "https://img.example/m.jpg",
          rating: 8.5,
          date: "2026-01-01",
          eps: 12,
          platform: "TV",
        },
      ],
      total: 1,
    });
  });

  it("搜索响应会过滤掉多余字段（tags / infobox / rating 原始对象等）", () => {
    const rawItem = {
      ...rawSubject,
      tags: [{ name: "科幻", count: 1 }],
      infobox: [],
    };
    const result = BangumiSubjectSearchResponseSchema.parse({
      total: 1,
      limit: 20,
      offset: 0,
      data: [rawItem],
    });

    expect(result.items[0]).not.toHaveProperty("tags");
    expect(result.items[0]).not.toHaveProperty("infobox");
    expect(result.items[0]).not.toHaveProperty("name_cn");
    expect(result.items[0]).not.toHaveProperty("images");
    expect(result.items[0]).not.toHaveProperty("collection");
  });
});

describe("Bangumi 数据缓存 Schema 回读校验", () => {
  it("日历数据：响应 Schema 解析后再用存储 Schema 回读应成功", () => {
    const domain = BangumiCalendarResponseSchema.parse(rawCalendar);
    const readBack = AnimeCalendarStoredSchema.safeParse(domain);
    expect(readBack.success).toBe(true);
    expect(readBack.data).toEqual(domain);
  });

  it("条目数据：响应 Schema 解析后再用存储 Schema 回读应成功", () => {
    const domain = BangumiSubjectSchema.parse(rawSubject);
    const readBack = AnimeSubjectStoredSchema.safeParse(domain);
    expect(readBack.success).toBe(true);
    expect(readBack.data).toEqual(domain);
  });

  it("剧集数据：响应 Schema 解析后再用存储 Schema 回读应成功", () => {
    const rawPage = {
      data: [rawEpisode],
      total: 1,
      limit: 20,
      offset: 0,
    };
    const page = BangumiEpisodesResponseSchema.parse(rawPage);
    const domain = { items: page.data, total: page.total };
    const readBack = AnimeEpisodesPageStoredSchema.safeParse(domain);
    expect(readBack.success).toBe(true);
    expect(readBack.data).toEqual(domain);
  });

  it("制作人员数据：响应 Schema 解析后再用存储 Schema 回读应成功", () => {
    const domain = BangumiPersonsResponseSchema.parse([rawPerson]);
    const readBack = AnimePersonsStoredSchema.safeParse(domain);
    expect(readBack.success).toBe(true);
    expect(readBack.data).toEqual(domain);
  });

  it("角色数据：响应 Schema 解析后再用存储 Schema 回读应成功", () => {
    const domain = BangumiCharactersResponseSchema.parse([rawCharacter]);
    const readBack = AnimeCharactersStoredSchema.safeParse(domain);
    expect(readBack.success).toBe(true);
    expect(readBack.data).toEqual(domain);
  });

  it("榜单条目：响应 Schema 解析后再用存储 Schema 回读应成功", () => {
    const rawRanked = {
      id: 326,
      name: "Shin Seiki Evangelion",
      name_cn: "新世纪福音战士",
      images,
      rank: 1,
      rating: { score: 9.1, rank: 1 },
    };
    const page = BangumiRankedSubjectsResponseSchema.parse({
      total: 1,
      limit: 10,
      offset: 0,
      data: [rawRanked],
    });

    expect(page).toEqual({
      items: [
        {
          id: 326,
          name: "新世纪福音战士",
          image: "https://img.example/m.jpg",
          rating: 9.1,
          summary: "",
        },
      ],
      total: 1,
    });

    const readBack = AnimeRankedSubjectsStoredSchema.safeParse(page.items);
    expect(readBack.success).toBe(true);
    expect(readBack.data).toEqual(page.items);
  });

  it("榜单条目：缺图或评分时回退为空图与 0 分", () => {
    const page = BangumiRankedSubjectsResponseSchema.parse({
      total: 1,
      limit: 10,
      offset: 0,
      data: [{ id: 1, name: "Anime", name_cn: "", images: {} }],
    });

    expect(page.items[0]).toMatchObject({
      image: "",
      rating: 0,
    });
  });
});
