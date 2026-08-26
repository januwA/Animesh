import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { ResumeTorrentUseCase } from "./ResumeTorrentUseCase";

describe("ResumeTorrentUseCase 恢复任务", () => {
  const mockRepo = {
    resumeTorrent: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 resumeTorrent 方法", async () => {
    const useCase = new ResumeTorrentUseCase(mockRepo);
    vi.mocked(mockRepo.resumeTorrent).mockResolvedValueOnce(undefined);
    await useCase.execute(NonEmptyStringSchema.parse("123"));
    expect(mockRepo.resumeTorrent).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("123"),
    );
  });
});
