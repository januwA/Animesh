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

  it("应该把订阅回调透传给 repository 的 subscribeTorrents 方法并返回退订函数", async () => {
    const unsubscribe = vi.fn();
    vi.mocked(mockRepo.subscribeTorrents).mockResolvedValueOnce(unsubscribe);

    const useCase = new SubscribeTorrentsUseCase(mockRepo);
    const onUpdate = vi.fn();
    const result = await useCase.execute(onUpdate);

    expect(mockRepo.subscribeTorrents).toHaveBeenCalledWith(onUpdate);
    expect(result).toBe(unsubscribe);
  });
});
