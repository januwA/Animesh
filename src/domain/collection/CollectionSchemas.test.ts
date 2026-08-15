import { describe, expect, it } from "vitest";
import {
  CollectionRecordSchema,
  FavoriteItemSchema,
  toFavoriteItem,
} from "./CollectionSchemas";

describe("FavoriteItemSchema 收藏条目 Schema", () => {
  it("应该能正确解析有效的收藏条目数据", () => {
    const mockItem = {
      subjectId: 101,
      name: "Original Name",
      nameCn: "中文名称",
      imageUrl: "https://example.com/image.jpg",
      rating: 8.5,
      addedAt: 1700000000000,
    };

    const result = FavoriteItemSchema.safeParse(mockItem);
    expect(result.success).toBe(true);
  });

  it("当必填字段缺失时应该校验失败", () => {
    const invalidItem = { subjectId: 101 };
    const result = FavoriteItemSchema.safeParse(invalidItem);
    expect(result.success).toBe(false);
  });

  it("should parse optional fields as null", () => {
    const mockItem = {
      subjectId: 101,
      name: "Name",
      nameCn: "名称",
      imageUrl: null,
      rating: null,
      addedAt: 1700000000000,
    };

    const result = FavoriteItemSchema.safeParse(mockItem);
    expect(result.success).toBe(true);
  });
});

describe("CollectionRecordSchema 后端收藏记录 Schema", () => {
  it("应该能正确解析后端返回的 snake_case 记录", () => {
    const mockRecord = {
      subject_id: 101,
      name: "Name",
      image_url: "https://example.com/cover.jpg",
      added_at: 1700000000000,
    };

    const result = CollectionRecordSchema.safeParse(mockRecord);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subject_id).toBe(101);
    }
  });

  it("当 image_url 为 null 时应该校验通过", () => {
    const mockRecord = {
      subject_id: 101,
      name: "Name",
      image_url: null,
      added_at: 1700000000000,
    };

    const result = CollectionRecordSchema.safeParse(mockRecord);
    expect(result.success).toBe(true);
  });

  it("toFavoriteItem 应正确映射字段为 camelCase", () => {
    const record = {
      subject_id: 101,
      name: "Name",
      image_url: null,
      added_at: 1700000000000,
    };

    expect(toFavoriteItem(record)).toEqual({
      subjectId: 101,
      name: "Name",
      imageUrl: null,
      addedAt: 1700000000000,
    });
  });
});
