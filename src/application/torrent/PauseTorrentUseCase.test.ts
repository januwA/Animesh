import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { PauseTorrentUseCase } from "./PauseTorrentUseCase";

describe("PauseTorrentUseCase 暂停任务", () => {
  const mockRepo = {
    pauseTorrent: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 pauseTorrent 方法", async () => {
    const useCase = new PauseTorrentUseCase(mockRepo);
    vi.mocked(mockRepo.pauseTorrent).mockResolvedValueOnce(undefined);
    await useCase.execute(NonEmptyStringSchema.parse("123"));
    expect(mockRepo.pauseTorrent).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("123"),
    );
  });
});
