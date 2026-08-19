import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { GetTorrentStreamUrlUseCase } from "./GetTorrentStreamUrlUseCase";

describe("GetTorrentStreamUrlUseCase 获取播放流地址", () => {
  const mockRepo = {
    getTorrentStreamUrl: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 getTorrentStreamUrl 方法", async () => {
    const useCase = new GetTorrentStreamUrlUseCase(mockRepo);
    vi.mocked(mockRepo.getTorrentStreamUrl).mockResolvedValueOnce(
      "http://localhost:8080/stream/123/1",
    );
    const result = await useCase.execute(NonEmptyStringSchema.parse("123"), 1);
    expect(mockRepo.getTorrentStreamUrl).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("123"),
      1,
    );
    expect(result).toBe("http://localhost:8080/stream/123/1");
  });
});
