import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { GetLocalIpUseCase } from "./GetLocalIpUseCase";

describe("GetLocalIpUseCase 获取本机局域网 IP", () => {
  const mockRepo = {
    getLocalIp: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 getLocalIp 方法", async () => {
    const useCase = new GetLocalIpUseCase(mockRepo);
    vi.mocked(mockRepo.getLocalIp).mockResolvedValueOnce("192.168.1.100");
    const result = await useCase.execute();
    expect(mockRepo.getLocalIp).toHaveBeenCalledOnce();
    expect(result).toBe("192.168.1.100");
  });
});
