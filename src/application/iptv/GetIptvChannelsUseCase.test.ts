import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IptvRepository } from "../../domain/iptv/IptvRepository";
import { GetIptvChannelsUseCase } from "./GetIptvChannelsUseCase";

describe("GetIptvChannelsUseCase 获取国家频道列表", () => {
  const mockRepo = {
    getChannels: vi.fn(),
  } as unknown as IptvRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该在缓存未命中时请求 Repository 并写入缓存", async () => {
    const freshData = [{ name: "CCTV-2", url: "https://example.com/b.m3u8" }];
    vi.mocked(mockRepo.getChannels).mockResolvedValueOnce(freshData);

    const useCase = new GetIptvChannelsUseCase(mockRepo);
    const result = await useCase.execute(Background, "CN");

    expect(mockRepo.getChannels).toHaveBeenCalledWith(Background, "CN");
    expect(result).toEqual(freshData);
  });
});
