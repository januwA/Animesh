import { describe, expect, it } from "vitest";
import type { CollectionRecord } from "./CollectionSchemas";
import { toFavoriteItem } from "./CollectionSchemas";

describe("toFavoriteItem", () => {
  it("应该将 snake_case 的 CollectionRecord 转换为 camelCase 的 FavoriteItem", () => {
    const record: CollectionRecord = {
      subject_id: 123,
      platform: "bangumi",
      name: "进击的巨人",
      image_url: "https://example.com/cover.jpg",
      added_at: 1700000000000,
    };

    const result = toFavoriteItem(record);

    expect(result).toEqual({
      subjectId: 123,
      platform: "bangumi",
      name: "进击的巨人",
      imageUrl: "https://example.com/cover.jpg",
      addedAt: 1700000000000,
    });
  });

  it("应该保留 image_url 为 null 的情况", () => {
    const record: CollectionRecord = {
      subject_id: 456,
      platform: "anilist",
      name: "葬送的芙莉莲",
      image_url: null,
      added_at: 1700000000000,
    };

    const result = toFavoriteItem(record);

    expect(result.imageUrl).toBeNull();
  });
});
