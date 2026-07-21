import { Background, Canceled, WithCancel } from "ajanuw-context";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../http/HttpClient";
import { HttpBangumiRepository } from "./HttpBangumiRepository";

describe("HttpBangumiRepository", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("getCalendar 能够成功获取并解析日历数据", async () => {
		const mockResponse = [
			{
				weekday: { id: 1, en: "Mon", cn: "星期一", ja: "月曜日" },
				items: [
					{
						id: 123,
						url: "https://api.bgm.tv/subject/123",
						name: "Original Name",
						name_cn: "动画中文名",
						air_date: "2026-07-07",
						air_weekday: 1,
					},
				],
			},
		];

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response);
		vi.stubGlobal("fetch", mockFetch);

		const repository = new HttpBangumiRepository(new HttpClient());
		const result = await repository.getCalendar(Background);

		expect(result).toHaveLength(1);
		expect(result[0].weekday.cn).toBe("星期一");
		expect(result[0].items[0].name_cn).toBe("动画中文名");
	});

	it("getCalendar 在 API 返回结构不匹配时应抛出错误", async () => {
		const mockResponse = { invalid: "structure" };

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response);
		vi.stubGlobal("fetch", mockFetch);

		const repository = new HttpBangumiRepository(new HttpClient());
		await expect(repository.getCalendar(Background)).rejects.toThrow(
			"Calendar API response structure mismatch",
		);
	});

	it("getCalendar 在网络请求失败时应抛出带 cause 的错误", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			statusText: "Internal Server Error",
		} as Response);
		vi.stubGlobal("fetch", mockFetch);

		const repository = new HttpBangumiRepository(new HttpClient());
		await expect(repository.getCalendar(Background)).rejects.toThrow(
			"Failed to fetch calendar",
		);
	});

	it("getCalendar 在 Context 取消时应抛出 Context 错误而不进行二次包装", async () => {
		const mockFetch = vi.fn();
		vi.stubGlobal("fetch", mockFetch);

		const [ctx, cancel] = WithCancel(Background);
		cancel();

		const repository = new HttpBangumiRepository(new HttpClient());
		await expect(repository.getCalendar(ctx)).rejects.toThrow(Canceled.message);
	});
});
describe("getSubjectPersons", () => {
	it("应该能够成功获取并解析制作人员数据", async () => {
		const mockResponse = [
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
		];

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response);
		vi.stubGlobal("fetch", mockFetch);

		const repository = new HttpBangumiRepository(new HttpClient());
		const result = await repository.getSubjectPersons(Background, "622206");

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("木村拓");
		expect(result[0].relation).toBe("导演");
	});

	it("在 API 返回结构不匹配时应抛出错误", async () => {
		const mockResponse = { invalid: "structure" };

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response);
		vi.stubGlobal("fetch", mockFetch);

		const repository = new HttpBangumiRepository(new HttpClient());
		await expect(
			repository.getSubjectPersons(Background, "622206"),
		).rejects.toThrow("Persons API response structure mismatch");
	});

	it("在网络请求失败时应抛出带 cause 的错误", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			statusText: "Internal Server Error",
		} as Response);
		vi.stubGlobal("fetch", mockFetch);

		const repository = new HttpBangumiRepository(new HttpClient());
		await expect(
			repository.getSubjectPersons(Background, "622206"),
		).rejects.toThrow("Failed to fetch subject persons");
	});
});

describe("getSubjectCharacters", () => {
	it("应该能够成功获取并解析角色数据（含声优）", async () => {
		const mockResponse = [
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
						short_summary: "声优",
						career: ["seiyu"],
						id: 36024,
						type: 1,
						locked: false,
					},
				],
			},
		];

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response);
		vi.stubGlobal("fetch", mockFetch);

		const repository = new HttpBangumiRepository(new HttpClient());
		const result = await repository.getSubjectCharacters(Background, "622206");

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("ヤニねこ");
		expect(result[0].actors[0].name).toBe("夏吉ゆうこ");
	});

	it("在 API 返回结构不匹配时应抛出错误", async () => {
		const mockResponse = { invalid: "structure" };

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response);
		vi.stubGlobal("fetch", mockFetch);

		const repository = new HttpBangumiRepository(new HttpClient());
		await expect(
			repository.getSubjectCharacters(Background, "622206"),
		).rejects.toThrow("Characters API response structure mismatch");
	});

	it("在网络请求失败时应抛出带 cause 的错误", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			statusText: "Internal Server Error",
		} as Response);
		vi.stubGlobal("fetch", mockFetch);

		const repository = new HttpBangumiRepository(new HttpClient());
		await expect(
			repository.getSubjectCharacters(Background, "622206"),
		).rejects.toThrow("Failed to fetch subject characters");
	});
});
