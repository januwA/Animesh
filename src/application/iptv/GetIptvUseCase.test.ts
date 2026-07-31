import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IptvCache } from "../../domain/iptv/IptvCache";
import type { IptvRepository } from "../../domain/iptv/IptvRepository";
import { GetIptvChannelsUseCase } from "./GetIptvChannelsUseCase";
import { GetIptvCountriesUseCase } from "./GetIptvCountriesUseCase";

describe("IPTV 相关的 UseCase 业务编排", () => {
	const mockRepo = {
		getCountries: vi.fn(),
		getChannels: vi.fn(),
	} as unknown as IptvRepository;

	const mockCache = {
		getCountries: vi.fn(),
		setCountries: vi.fn(),
		getChannels: vi.fn(),
		setChannels: vi.fn(),
	} as unknown as IptvCache;

	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("GetIptvCountriesUseCase 应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
		const cachedData = [{ name: "China", code: "CN", flag: "🇨🇳" }];
		vi.mocked(mockCache.getCountries).mockResolvedValueOnce(cachedData);

		const useCase = new GetIptvCountriesUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background);

		expect(mockCache.getCountries).toHaveBeenCalledWith(Background);
		expect(mockRepo.getCountries).not.toHaveBeenCalled();
		expect(result).toEqual(cachedData);
	});

	it("GetIptvCountriesUseCase 应该在缓存未命中时请求 Repository 并写入缓存", async () => {
		const freshData = [{ name: "Japan", code: "JP", flag: "🇯🇵" }];
		vi.mocked(mockCache.getCountries).mockResolvedValueOnce(null);
		vi.mocked(mockRepo.getCountries).mockResolvedValueOnce(freshData);

		const useCase = new GetIptvCountriesUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background);

		expect(mockCache.getCountries).toHaveBeenCalledWith(Background);
		expect(mockRepo.getCountries).toHaveBeenCalledWith(Background);
		expect(mockCache.setCountries).toHaveBeenCalledWith(Background, freshData);
		expect(result).toEqual(freshData);
	});

	it("GetIptvChannelsUseCase 应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
		const cachedData = [{ name: "CCTV-1", url: "https://example.com/a.m3u8" }];
		vi.mocked(mockCache.getChannels).mockResolvedValueOnce(cachedData);

		const useCase = new GetIptvChannelsUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background, "CN");

		expect(mockCache.getChannels).toHaveBeenCalledWith(Background, "CN");
		expect(mockRepo.getChannels).not.toHaveBeenCalled();
		expect(result).toEqual(cachedData);
	});

	it("GetIptvChannelsUseCase 应该在缓存未命中时请求 Repository 并写入缓存", async () => {
		const freshData = [{ name: "CCTV-2", url: "https://example.com/b.m3u8" }];
		vi.mocked(mockCache.getChannels).mockResolvedValueOnce(null);
		vi.mocked(mockRepo.getChannels).mockResolvedValueOnce(freshData);

		const useCase = new GetIptvChannelsUseCase(mockRepo, mockCache);
		const result = await useCase.execute(Background, "CN");

		expect(mockCache.getChannels).toHaveBeenCalledWith(Background, "CN");
		expect(mockRepo.getChannels).toHaveBeenCalledWith(Background, "CN");
		expect(mockCache.setChannels).toHaveBeenCalledWith(
			Background,
			"CN",
			freshData,
		);
		expect(result).toEqual(freshData);
	});
});
