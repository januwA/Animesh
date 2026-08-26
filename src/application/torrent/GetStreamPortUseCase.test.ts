import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { GetStreamPortUseCase } from "./GetStreamPortUseCase";

describe("GetStreamPortUseCase 获取流媒体端口", () => {
  const mockRepo = {
    getStreamPort: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 getStreamPort 方法", async () => {
    const useCase = new GetStreamPortUseCase(mockRepo);
    vi.mocked(mockRepo.getStreamPort).mockResolvedValueOnce(45678);
    const result = await useCase.execute();
    expect(mockRepo.getStreamPort).toHaveBeenCalledOnce();
    expect(result).toBe(45678);
  });
});
