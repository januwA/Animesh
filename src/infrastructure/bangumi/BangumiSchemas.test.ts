import { describe, expect, it } from "vitest";
import {
  BangumiCalendarResponseSchema,
  BangumiSubjectSearchResponseSchema,
} from "./BangumiSchemas";

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

const rawCalendarItem = {
  id: 709326,
  url: "https://bgm.example/subject/709326",
  type: 2,
  name: "Kiff: Scarm II: The Screamwriter",
  name_cn: "动画中文名",
  summary: "简介",
  air_date: "2026-10-02",
  air_weekday: 2,
  rating: { total: 10, score: 7.5 },
  rank: 12,
  images,
};

const rawCalendarDay = {
  weekday: { en: "Tue", cn: "星期二", ja: "火曜日", id: 2 },
  items: [rawCalendarItem],
};

describe("Bangumi 每日放送 Schema", () => {
  it("解析后仅保留表现层所需字段并剥离多余字段", () => {
    const result = BangumiCalendarResponseSchema.parse([rawCalendarDay]);

    expect(result).toEqual([
      {
        weekday: { id: 2 },
        items: [
          {
            id: 709326,
            name: "动画中文名",
            image: "https://img.example/m.jpg",
            rating: 7.5,
          },
        ],
      },
    ]);
  });

  // 回归：bgm.tv 对尚无封面图的新条目返回 images: null
  it("图片字段为 null 时降级为空字符串", () => {
    const result = BangumiCalendarResponseSchema.parse([
      {
        ...rawCalendarDay,
        items: [{ ...rawCalendarItem, images: null }],
      },
    ]);

    expect(result[0].items[0].image).toBe("");
  });

  it("各尺寸图片均为空串时降级为空字符串", () => {
    const result = BangumiCalendarResponseSchema.parse([
      {
        ...rawCalendarDay,
        items: [{ ...rawCalendarItem, images: {} }],
      },
    ]);

    expect(result[0].items[0].image).toBe("");
  });

  it("图片优先取 common 尺寸", () => {
    const result = BangumiCalendarResponseSchema.parse([
      {
        ...rawCalendarDay,
        items: [
          {
            ...rawCalendarItem,
            images: { ...images, common: "https://img.example/c.jpg" },
          },
        ],
      },
    ]);

    expect(result[0].items[0].image).toBe("https://img.example/c.jpg");
  });

  it("中文名为空串时回退原名", () => {
    const result = BangumiCalendarResponseSchema.parse([
      {
        ...rawCalendarDay,
        items: [{ ...rawCalendarItem, name_cn: "" }],
      },
    ]);

    expect(result[0].items[0].name).toBe("Kiff: Scarm II: The Screamwriter");
  });

  it("评分缺失或为 null 时降级为 0", () => {
    const result = BangumiCalendarResponseSchema.parse([
      {
        ...rawCalendarDay,
        items: [
          { ...rawCalendarItem, rating: null },
          { ...rawCalendarItem, id: 2, rating: undefined },
        ],
      },
    ]);

    expect(result[0].items.map((item) => item.rating)).toEqual([0, 0]);
  });
});
