import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IptvCache } from "../../domain/iptv/IptvCache";
import type { IptvRepository } from "../../domain/iptv/IptvRepository";
import { GetIptvCountriesUseCase } from "./GetIptvCountriesUseCase";

describe("GetIptvCountriesUseCase 获取 IPTV 国家列表", () => {
  const mockRepo = {
    getCountries: vi.fn(),
  } as unknown as IptvRepository;

  const mockCache = {
    getCountries: vi.fn(),
    setCountries: vi.fn(),
  } as unknown as IptvCache;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该在缓存命中时直接返回缓存数据且不请求 Repository", async () => {
    const cachedData = [{ name: "China", code: "CN", flag: "🇨🇳" }];
    vi.mocked(mockCache.getCountries).mockResolvedValueOnce(cachedData);

    const useCase = new GetIptvCountriesUseCase(mockRepo, mockCache);
    const result = await useCase.execute(Background);

    expect(mockCache.getCountries).toHaveBeenCalledWith(Background);
    expect(mockRepo.getCountries).not.toHaveBeenCalled();
    expect(result).toEqual(cachedData);
  });

  it("应该在缓存未命中时请求 Repository 并写入缓存", async () => {
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
});
