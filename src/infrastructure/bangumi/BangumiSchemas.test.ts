import { describe, expect, it } from "vitest";
import { BangumiSubjectSearchResponseSchema } from "./BangumiSchemas";

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
