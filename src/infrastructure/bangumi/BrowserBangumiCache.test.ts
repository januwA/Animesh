import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";
import { BrowserBangumiCache } from "./BrowserBangumiCache";

describe("BrowserBangumiCache 浏览器缓存实现", () => {
	let cache: BrowserBangumiCache;

	const mockCalendar: BangumiCalendarDay[] = [
		{
			weekday: { id: 1, en: "Monday", cn: "星期一", ja: "月曜日" },
			items: [
				{
					id: 101,
					url: "https://bgm.tv/subject/101",
					name: "Anime Monday",
					name_cn: "周一动画",
					air_date: "2026-07-13",
					air_weekday: 1,
				},
			],
		},
	];

	beforeEach(() => {
		localStorage.clear();
		vi.useRealTimers();
		cache = new BrowserBangumiCache();
	});

	it("当没有缓存时，应该返回 null", async () => {
		const result = await cache.getCalendar(Background);
		expect(result).toBeNull();
	});

	it("当成功缓存且未过期时，应该能够正确读取缓存数据", async () => {
		await cache.setCalendar(Background, mockCalendar);
		const result = await cache.getCalendar(Background);
		expect(result).toEqual(mockCalendar);
	});

	it("当缓存已过期（超过12小时）时，应该返回 null 并清除缓存", async () => {
		vi.useFakeTimers();
		const now = Date.now();
		vi.setSystemTime(now);

		await cache.setCalendar(Background, mockCalendar);

		// 快进 12 小时零 1 毫秒
		vi.setSystemTime(now + 12 * 60 * 60 * 1000 + 1);

		const result = await cache.getCalendar(Background);
		expect(result).toBeNull();
		expect(localStorage.getItem("bangumi:calendar")).toBeNull();
	});

	it("当缓存的数据结构与 Zod Schema 不匹配时，应该返回 null 并清除缓存", async () => {
		const invalidEntry = {
			data: [{ weekday: { id: "not-a-number" } }], // 格式错误
			expiry: Date.now() + 10000,
		};
		localStorage.setItem("bangumi:calendar", JSON.stringify(invalidEntry));

		const result = await cache.getCalendar(Background);
		expect(result).toBeNull();
		expect(localStorage.getItem("bangumi:calendar")).toBeNull();
	});

	it("当 localStorage 中的数据不是合法的 JSON 时，应该返回 null 且不崩溃", async () => {
		localStorage.setItem("bangumi:calendar", "invalid-json-string{");

		const result = await cache.getCalendar(Background);
		expect(result).toBeNull();
	});
});
