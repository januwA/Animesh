import { describe, expect, it } from "vitest";
import {
	CollectionsStateSchema,
	FavoriteItemSchema,
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

describe("CollectionsStateSchema 收藏状态 Schema", () => {
	it("应该能正确解析有效的收藏状态数据", () => {
		const mockState = {
			items: [
				{
					subjectId: 101,
					name: "Name",
					nameCn: "名称",
					imageUrl: null,
					rating: null,
					addedAt: 1700000000000,
				},
			],
			lastUpdatedAt: 1700000000001,
		};

		const result = CollectionsStateSchema.safeParse(mockState);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.items).toHaveLength(1);
			expect(result.data.items[0].subjectId).toBe(101);
		}
	});

	it("当 items 为空数组时应该校验通过", () => {
		const mockState = {
			items: [],
			lastUpdatedAt: 1700000000000,
		};

		const result = CollectionsStateSchema.safeParse(mockState);
		expect(result.success).toBe(true);
	});
});
