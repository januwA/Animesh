import { describe, expect, it } from "vitest";
import { BangumiCalendarResponseSchema } from "./BangumiSchemas";

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
