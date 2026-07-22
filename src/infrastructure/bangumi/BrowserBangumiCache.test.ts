import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	BangumiCalendarDay,
	BangumiCharacter,
	BangumiEpisode,
	BangumiPerson,
	BangumiSubject,
} from "@/domain/bangumi/BangumiSchemas";
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

	const mockSubject: BangumiSubject = {
		id: 1,
		name: "Test Subject",
		name_cn: "测试条目",
		summary: "A test subject",
	};

	const mockEpisodes: BangumiEpisode[] = [
		{
			id: 1,
			type: 0,
			sort: 1,
			name: "Episode 1",
			name_cn: "第1集",
			duration: "24m",
			airdate: "2026-07-13",
			desc: "First episode",
		},
	];

	const mockPerson: BangumiPerson = {
		id: 1,
		name: "Director",
		relation: "导演",
		career: ["导演"],
		type: 1,
		eps: "1-12",
		images: { small: "", grid: "", large: "", medium: "" },
	};

	const mockCharacter: BangumiCharacter = {
		id: 1,
		name: "Hero",
		relation: "主角",
		type: 1,
		summary: "Main character",
		images: { small: "", grid: "", large: "", medium: "" },
		actors: [],
	};

	beforeEach(() => {
		localStorage.clear();
		vi.useRealTimers();
		cache = new BrowserBangumiCache();
	});

	describe("calendar 缓存", () => {
		const cacheKey = "bangumi:calendar";

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

			vi.setSystemTime(now + 12 * 60 * 60 * 1000 + 1);

			const result = await cache.getCalendar(Background);
			expect(result).toBeNull();
			expect(localStorage.getItem(cacheKey)).toBeNull();
		});

		it("当缓存的数据结构与 Zod Schema 不匹配时，应该返回 null 并清除缓存", async () => {
			const invalidEntry = {
				data: [{ weekday: { id: "not-a-number" } }],
				expiry: Date.now() + 10000,
			};
			localStorage.setItem(cacheKey, JSON.stringify(invalidEntry));

			const result = await cache.getCalendar(Background);
			expect(result).toBeNull();
			expect(localStorage.getItem(cacheKey)).toBeNull();
		});

		it("当 localStorage 中的数据不是合法的 JSON 时，应该返回 null 且不崩溃", async () => {
			localStorage.setItem(cacheKey, "invalid-json-string{");

			const result = await cache.getCalendar(Background);
			expect(result).toBeNull();
		});
	});

	describe("subject 缓存", () => {
		const subjectId = "42";
		const cacheKey = "bangumi:subject:42";

		it("当没有缓存时，应该返回 null", async () => {
			const result = await cache.getSubject(Background, subjectId);
			expect(result).toBeNull();
		});

		it("当成功缓存且未过期时，应该能够正确读取缓存数据", async () => {
			await cache.setSubject(Background, subjectId, mockSubject);
			const result = await cache.getSubject(Background, subjectId);
			expect(result).toEqual(mockSubject);
		});

		it("不同的 subjectId 应该隔离缓存", async () => {
			await cache.setSubject(Background, "1", mockSubject);
			const result = await cache.getSubject(Background, "2");
			expect(result).toBeNull();
		});

		it("当缓存已过期时，应该返回 null 并清除缓存", async () => {
			vi.useFakeTimers();
			const now = Date.now();
			vi.setSystemTime(now);

			await cache.setSubject(Background, subjectId, mockSubject);
			vi.setSystemTime(now + 12 * 60 * 60 * 1000 + 1);

			const result = await cache.getSubject(Background, subjectId);
			expect(result).toBeNull();
			expect(localStorage.getItem(cacheKey)).toBeNull();
		});

		it("当缓存数据格式不匹配时，应该返回 null 并清除缓存", async () => {
			const invalidEntry = {
				data: { id: "not-a-number", name: 123 },
				expiry: Date.now() + 10000,
			};
			localStorage.setItem(cacheKey, JSON.stringify(invalidEntry));

			const result = await cache.getSubject(Background, subjectId);
			expect(result).toBeNull();
			expect(localStorage.getItem(cacheKey)).toBeNull();
		});
	});

	describe("episodes 缓存", () => {
		const subjectId = "42";

		it("当没有缓存时，应该返回 null", async () => {
			const result = await cache.getEpisodes(Background, subjectId);
			expect(result).toBeNull();
		});

		it("当成功缓存且未过期时，应该能够正确读取缓存数据", async () => {
			await cache.setEpisodes(Background, subjectId, mockEpisodes);
			const result = await cache.getEpisodes(Background, subjectId);
			expect(result).toEqual(mockEpisodes);
		});

		it("不同的 subjectId 应该隔离缓存", async () => {
			await cache.setEpisodes(Background, "1", mockEpisodes);
			const result = await cache.getEpisodes(Background, "2");
			expect(result).toBeNull();
		});
	});

	describe("persons 缓存", () => {
		const subjectId = "42";
		const cacheKey = "bangumi:persons:42";

		it("当没有缓存时，应该返回 null", async () => {
			const result = await cache.getPersons(Background, subjectId);
			expect(result).toBeNull();
		});

		it("当成功缓存且未过期时，应该能够正确读取缓存数据", async () => {
			await cache.setPersons(Background, subjectId, [mockPerson]);
			const result = await cache.getPersons(Background, subjectId);
			expect(result).toEqual([mockPerson]);
		});

		it("不同的 subjectId 应该隔离缓存", async () => {
			await cache.setPersons(Background, "1", [mockPerson]);
			const result = await cache.getPersons(Background, "2");
			expect(result).toBeNull();
		});

		it("当缓存数据格式不匹配时，应该返回 null 并清除缓存", async () => {
			const invalidEntry = {
				data: [{ id: "not-a-number" }],
				expiry: Date.now() + 10000,
			};
			localStorage.setItem(cacheKey, JSON.stringify(invalidEntry));

			const result = await cache.getPersons(Background, subjectId);
			expect(result).toBeNull();
			expect(localStorage.getItem(cacheKey)).toBeNull();
		});
	});

	describe("characters 缓存", () => {
		const subjectId = "42";
		const cacheKey = "bangumi:characters:42";

		it("当没有缓存时，应该返回 null", async () => {
			const result = await cache.getCharacters(Background, subjectId);
			expect(result).toBeNull();
		});

		it("当成功缓存且未过期时，应该能够正确读取缓存数据", async () => {
			await cache.setCharacters(Background, subjectId, [mockCharacter]);
			const result = await cache.getCharacters(Background, subjectId);
			expect(result).toEqual([mockCharacter]);
		});

		it("不同的 subjectId 应该隔离缓存", async () => {
			await cache.setCharacters(Background, "1", [mockCharacter]);
			const result = await cache.getCharacters(Background, "2");
			expect(result).toBeNull();
		});

		it("当缓存数据格式不匹配时，应该返回 null 并清除缓存", async () => {
			const invalidEntry = {
				data: [{ id: "not-a-number" }],
				expiry: Date.now() + 10000,
			};
			localStorage.setItem(cacheKey, JSON.stringify(invalidEntry));

			const result = await cache.getCharacters(Background, subjectId);
			expect(result).toBeNull();
			expect(localStorage.getItem(cacheKey)).toBeNull();
		});
	});

	it("过期缓存应该被清除并返回 null (通用场景)", async () => {
		vi.useFakeTimers();
		const now = Date.now();
		vi.setSystemTime(now);

		await cache.setSubject(Background, "99", mockSubject);
		vi.setSystemTime(now + 12 * 60 * 60 * 1000 + 1);

		const result = await cache.getSubject(Background, "99");
		expect(result).toBeNull();
	});
});
