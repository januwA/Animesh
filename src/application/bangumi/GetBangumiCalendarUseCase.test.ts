import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BangumiCache } from "../../domain/bangumi/BangumiCache";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import { GetBangumiCalendarUseCase } from "./GetBangumiCalendarUseCase";
import { GetBangumiCharactersUseCase } from "./GetBangumiCharactersUseCase";
import { GetBangumiEpisodesUseCase } from "./GetBangumiEpisodesUseCase";
import { GetBangumiPersonsUseCase } from "./GetBangumiPersonsUseCase";
import { GetBangumiSubjectUseCase } from "./GetBangumiSubjectUseCase";

describe("Bangumi 相关的 UseCase 业务编排", () => {
	const mockRepo = {
		getCalendar: vi.fn(),
		getSubject: vi.fn(),
		getEpisodes: vi.fn(),
		getSubjectPersons: vi.fn(),
		getSubjectCharacters: vi.fn(),
	} as unknown as BangumiRepository;

	const mockCache = {
		getCalendar: vi.fn(),
		setCalendar: vi.fn(),
		getSubject: vi.fn(),
		setSubject: vi.fn(),
		getEpisodes: vi.fn(),
		setEpisodes: vi.fn(),
		getPersons: vi.fn(),
		setPersons: vi.fn(),
		getCharacters: vi.fn(),
		setCharacters: vi.fn(),
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

	it("GetBangumiSubjectUseCase 应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
		const cachedData = { id: 1, name: "cached", name_cn: "缓存" };
		vi.mocked(mockCache.getSubject).mockResolvedValueOnce(cachedData as any);

		const useCase = new GetBangumiSubjectUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background, "1");

		expect(mockCache.getSubject).toHaveBeenCalledWith(Background, "1");
		expect(mockRepo.getSubject).not.toHaveBeenCalled();
		expect(result).toEqual(cachedData);
	});

	it("GetBangumiSubjectUseCase 应该在缓存未命中时请求 Repository 并写入缓存", async () => {
		const freshData = { id: 1, name: "fresh", name_cn: "新鲜" };
		vi.mocked(mockCache.getSubject).mockResolvedValueOnce(null);
		vi.mocked(mockRepo.getSubject).mockResolvedValueOnce(freshData as any);

		const useCase = new GetBangumiSubjectUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background, "1");

		expect(mockCache.getSubject).toHaveBeenCalledWith(Background, "1");
		expect(mockRepo.getSubject).toHaveBeenCalledWith(Background, "1");
		expect(mockCache.setSubject).toHaveBeenCalledWith(
			Background,
			"1",
			freshData,
		);
		expect(result).toEqual(freshData);
	});

	it("GetBangumiEpisodesUseCase 应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
		const cachedData = [
			{ id: 1, name: "ep1", name_cn: "集1", sort: 1, type: 0 },
		];
		vi.mocked(mockCache.getEpisodes).mockResolvedValueOnce(cachedData as any);

		const useCase = new GetBangumiEpisodesUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background, "1");

		expect(mockCache.getEpisodes).toHaveBeenCalledWith(Background, "1");
		expect(mockRepo.getEpisodes).not.toHaveBeenCalled();
		expect(result).toEqual(cachedData);
	});

	it("GetBangumiEpisodesUseCase 应该在缓存未命中时请求 Repository 并写入缓存", async () => {
		const freshData = [
			{ id: 1, name: "ep1", name_cn: "集1", sort: 1, type: 0 },
		];
		vi.mocked(mockCache.getEpisodes).mockResolvedValueOnce(null);
		vi.mocked(mockRepo.getEpisodes).mockResolvedValueOnce(freshData as any);

		const useCase = new GetBangumiEpisodesUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background, "1");

		expect(mockCache.getEpisodes).toHaveBeenCalledWith(Background, "1");
		expect(mockRepo.getEpisodes).toHaveBeenCalledWith(Background, "1");
		expect(mockCache.setEpisodes).toHaveBeenCalledWith(
			Background,
			"1",
			freshData,
		);
		expect(result).toEqual(freshData);
	});

	it("GetBangumiPersonsUseCase 应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
		const cachedData = [
			{
				id: 1,
				name: "person1",
				relation: "导演",
				career: ["导演"],
				type: 1,
				eps: "1-12",
				images: { small: "", grid: "", large: "", medium: "" },
			},
		];
		vi.mocked(mockCache.getPersons).mockResolvedValueOnce(cachedData as any);

		const useCase = new GetBangumiPersonsUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background, "1");

		expect(mockCache.getPersons).toHaveBeenCalledWith(Background, "1");
		expect(mockRepo.getSubjectPersons).not.toHaveBeenCalled();
		expect(result).toEqual(cachedData);
	});

	it("GetBangumiPersonsUseCase 应该在缓存未命中时请求 Repository 并写入缓存", async () => {
		const freshData = [
			{
				id: 1,
				name: "person1",
				relation: "导演",
				career: ["导演"],
				type: 1,
				eps: "1-12",
				images: { small: "", grid: "", large: "", medium: "" },
			},
		];
		vi.mocked(mockCache.getPersons).mockResolvedValueOnce(null);
		vi.mocked(mockRepo.getSubjectPersons).mockResolvedValueOnce(
			freshData as any,
		);

		const useCase = new GetBangumiPersonsUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background, "1");

		expect(mockCache.getPersons).toHaveBeenCalledWith(Background, "1");
		expect(mockRepo.getSubjectPersons).toHaveBeenCalledWith(Background, "1");
		expect(mockCache.setPersons).toHaveBeenCalledWith(
			Background,
			"1",
			freshData,
		);
		expect(result).toEqual(freshData);
	});

	it("GetBangumiCharactersUseCase 应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
		const cachedData = [
			{
				id: 1,
				name: "char1",
				relation: "主角",
				type: 1,
				summary: "desc",
				images: { small: "", grid: "", large: "", medium: "" },
				actors: [],
			},
		];
		vi.mocked(mockCache.getCharacters).mockResolvedValueOnce(cachedData as any);

		const useCase = new GetBangumiCharactersUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background, "1");

		expect(mockCache.getCharacters).toHaveBeenCalledWith(Background, "1");
		expect(mockRepo.getSubjectCharacters).not.toHaveBeenCalled();
		expect(result).toEqual(cachedData);
	});

	it("GetBangumiCharactersUseCase 应该在缓存未命中时请求 Repository 并写入缓存", async () => {
		const freshData = [
			{
				id: 1,
				name: "char1",
				relation: "主角",
				type: 1,
				summary: "desc",
				images: { small: "", grid: "", large: "", medium: "" },
				actors: [],
			},
		];
		vi.mocked(mockCache.getCharacters).mockResolvedValueOnce(null);
		vi.mocked(mockRepo.getSubjectCharacters).mockResolvedValueOnce(
			freshData as any,
		);

		const useCase = new GetBangumiCharactersUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background, "1");

		expect(mockCache.getCharacters).toHaveBeenCalledWith(Background, "1");
		expect(mockRepo.getSubjectCharacters).toHaveBeenCalledWith(Background, "1");
		expect(mockCache.setCharacters).toHaveBeenCalledWith(
			Background,
			"1",
			freshData,
		);
		expect(result).toEqual(freshData);
	});
});
