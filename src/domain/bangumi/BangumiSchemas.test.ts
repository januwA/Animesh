import { describe, expect, it } from "vitest";
import {
	BangumiCalendarResponseSchema,
	BangumiCharactersResponseSchema,
	BangumiPersonsResponseSchema,
} from "./BangumiSchemas";

describe("新番日历数据 Schema 校验", () => {
	it("当 images, rating, rank, collection 字段为 null 或不存在时，应该校验通过", () => {
		const mockData = [
			{
				weekday: { id: 1, en: "Mon", cn: "周一", ja: "Mon" },
				items: [
					{
						id: 101,
						url: "https://bgm.tv/subject/101",
						name: "Original Name",
						name_cn: "中文名称",
						air_date: "2026-07-01",
						air_weekday: 1,
						rating: null,
						rank: null,
						images: null,
						collection: null,
					},
					{
						id: 102,
						url: "https://bgm.tv/subject/102",
						name: "Original Name 2",
						name_cn: "中文名称 2",
						air_date: "2026-07-02",
						air_weekday: 2,
					},
				],
			},
		];

		const result = BangumiCalendarResponseSchema.safeParse(mockData);
		expect(result.success).toBe(true);
	});
});

describe("制作人员数据 Schema 校验", () => {
	it("应该能正确解析有效的制作人员数据", () => {
		const mockData = [
			{
				images: {
					small: "https://example.com/small.jpg",
					grid: "https://example.com/grid.jpg",
					large: "https://example.com/large.jpg",
					medium: "https://example.com/medium.jpg",
				},
				name: "木村拓",
				relation: "导演",
				career: ["producer"],
				type: 1,
				id: 44615,
				eps: "",
			},
			{
				images: {
					small: "",
					grid: "",
					large: "",
					medium: "",
				},
				name: "あおしまたかし",
				relation: "脚本",
				career: ["producer"],
				type: 1,
				id: 2639,
				eps: "3",
			},
		];

		const result = BangumiPersonsResponseSchema.safeParse(mockData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toHaveLength(2);
			expect(result.data[0].name).toBe("木村拓");
			expect(result.data[1].eps).toBe("3");
		}
	});

	it("当制作人员数据字段缺失时应该校验失败", () => {
		const invalidData = [{ name: "缺失字段" }];
		const result = BangumiPersonsResponseSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});
});

describe("角色数据 Schema 校验", () => {
	it("应该能正确解析有效的角色数据（含声优信息）", () => {
		const mockData = [
			{
				images: {
					small: "https://example.com/small.jpg",
					grid: "https://example.com/grid.jpg",
					large: "https://example.com/large.jpg",
					medium: "https://example.com/medium.jpg",
				},
				name: "ヤニねこ",
				summary: "主角猫",
				relation: "主角",
				type: 1,
				id: 174916,
				actors: [
					{
						images: {
							small: "https://example.com/small.jpg",
							grid: "https://example.com/grid.jpg",
							large: "https://example.com/large.jpg",
							medium: "https://example.com/medium.jpg",
						},
						name: "夏吉ゆうこ",
						short_summary: "日本声优",
						career: ["seiyu"],
						id: 36024,
						type: 1,
						locked: false,
					},
				],
			},
			{
				images: {
					small: "",
					grid: "",
					large: "",
					medium: "",
				},
				name: "配角角色",
				summary: "",
				relation: "配角",
				type: 1,
				id: 99999,
				actors: [],
			},
		];

		const result = BangumiCharactersResponseSchema.safeParse(mockData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toHaveLength(2);
			expect(result.data[0].actors).toHaveLength(1);
			expect(result.data[0].actors[0].name).toBe("夏吉ゆうこ");
		}
	});

	it("当角色数据中的声优字段缺失时应该校验失败", () => {
		const invalidData = [
			{
				images: {
					small: "",
					grid: "",
					large: "",
					medium: "",
				},
				name: "角色",
				summary: "",
				relation: "主角",
				type: 1,
				id: 1,
			},
		];
		const result = BangumiCharactersResponseSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});
});
