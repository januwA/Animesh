import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IptvRepository } from "../../domain/iptv/IptvRepository";
import { GetIptvCountriesUseCase } from "./GetIptvCountriesUseCase";

describe("GetIptvCountriesUseCase 获取 IPTV 国家列表", () => {
  const mockRepo = {
    getCountries: vi.fn(),
  } as unknown as IptvRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该在缓存未命中时请求 Repository 并写入缓存", async () => {
    const freshData = [{ name: "Japan", code: "JP", flag: "🇯🇵" }];
    vi.mocked(mockRepo.getCountries).mockResolvedValueOnce(freshData);

    const useCase = new GetIptvCountriesUseCase(mockRepo);
    const result = await useCase.execute(Background);

    expect(mockRepo.getCountries).toHaveBeenCalledWith(Background);
    expect(result).toEqual(freshData);
  });
});
