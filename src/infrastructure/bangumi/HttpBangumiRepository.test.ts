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
