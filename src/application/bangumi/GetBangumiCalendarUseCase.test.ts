import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BangumiCache } from "../../domain/bangumi/BangumiCache";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import { GetBangumiCalendarUseCase } from "./GetBangumiCalendarUseCase";

describe("Bangumi 相关的 UseCase 业务编排", () => {
	const mockRepo = {
		getCalendar: vi.fn(),
	} as unknown as BangumiRepository;

	const mockCache = {
		getCalendar: vi.fn(),
		setCalendar: vi.fn(),
	} as unknown as BangumiCache;

	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("GetBangumiCalendarUseCase 应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
		const cachedData = [
			{
				weekday: { id: 1, en: "Monday", cn: "星期一", ja: "月曜日" },
				items: [{ id: 101, name: "Anime Monday" } as any],
			},
		];
		vi.mocked(mockCache.getCalendar).mockResolvedValueOnce(cachedData);

		const useCase = new GetBangumiCalendarUseCase(mockRepo, mockCache);
		const results = await useCase.execute(Background);

		expect(mockCache.getCalendar).toHaveBeenCalledWith(Background);
		expect(mockRepo.getCalendar).not.toHaveBeenCalled();
		expect(results).toEqual(cachedData);
	});

	it("GetBangumiCalendarUseCase 应该在缓存未命中时请求 Repository 并写入缓存", async () => {
		const freshData = [
			{
				weekday: { id: 1, en: "Monday", cn: "星期一", ja: "月曜日" },
				items: [{ id: 101, name: "Anime Monday" } as any],
			},
		];
		vi.mocked(mockCache.getCalendar).mockResolvedValueOnce(null);
		vi.mocked(mockRepo.getCalendar).mockResolvedValueOnce(freshData);

		const useCase = new GetBangumiCalendarUseCase(mockRepo, mockCache);
		const results = await useCase.execute(Background);

		expect(mockCache.getCalendar).toHaveBeenCalledWith(Background);
		expect(mockRepo.getCalendar).toHaveBeenCalledWith(Background);
		expect(mockCache.setCalendar).toHaveBeenCalledWith(Background, freshData);
		expect(results).toEqual(freshData);
	});
});
