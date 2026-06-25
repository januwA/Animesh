import { describe, expect, it, vi } from "vitest";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import { GetBangumiCalendarUseCase } from "./GetBangumiCalendarUseCase";

describe("Bangumi 相关的 UseCase 业务编排", () => {
	const mockRepo = {
		getCalendar: vi.fn(),
	} as unknown as BangumiRepository;

	it("GetBangumiCalendarUseCase 应该正确获取新番排程列表", async () => {
		const useCase = new GetBangumiCalendarUseCase(mockRepo);
		vi.mocked(mockRepo.getCalendar).mockResolvedValueOnce([
			{
				weekday: { id: 1, name: "Monday" },
				bangumis: [{ id: 101, name: "Anime Monday" } as any],
			},
		]);
		const results = await useCase.execute();
		expect(mockRepo.getCalendar).toHaveBeenCalled();
		expect(results).toEqual([
			{
				weekday: { id: 1, name: "Monday" },
				bangumis: [{ id: 101, name: "Anime Monday" }],
			},
		]);
	});
});
