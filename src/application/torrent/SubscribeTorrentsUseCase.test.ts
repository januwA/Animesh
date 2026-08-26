import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { SubscribeTorrentsUseCase } from "./SubscribeTorrentsUseCase";

describe("SubscribeTorrentsUseCase 订阅任务状态", () => {
  const mockRepo = {
    subscribeTorrents: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该返回 repository 的 ReadableStream", async () => {
    const mockStream = new ReadableStream();
    vi.mocked(mockRepo.subscribeTorrents).mockResolvedValueOnce(mockStream);

    const useCase = new SubscribeTorrentsUseCase(mockRepo);
    const result = await useCase.execute();

    expect(mockRepo.subscribeTorrents).toHaveBeenCalledOnce();
    expect(result).toBe(mockStream);
  });
});
