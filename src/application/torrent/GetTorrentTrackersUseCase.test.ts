import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { GetTorrentTrackersUseCase } from "./GetTorrentTrackersUseCase";

describe("GetTorrentTrackersUseCase 获取 Tracker 列表", () => {
  const mockRepo = {
    getTrackers: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 getTrackers 方法", async () => {
    const trackers = ["t1.example.com", "t2.example.com"];
    vi.mocked(mockRepo.getTrackers).mockResolvedValueOnce(trackers);
    const useCase = new GetTorrentTrackersUseCase(mockRepo);
    const result = await useCase.execute("hash1" as NonEmptyString);
    expect(mockRepo.getTrackers).toHaveBeenCalledOnce();
    expect(result).toEqual(trackers);
  });
});
