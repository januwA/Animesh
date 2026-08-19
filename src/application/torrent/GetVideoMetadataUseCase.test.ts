import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { GetVideoMetadataUseCase } from "./GetVideoMetadataUseCase";

describe("GetVideoMetadataUseCase 获取视频元数据", () => {
  const mockRepo = {
    getVideoMetadata: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 getVideoMetadata 方法", async () => {
    const useCase = new GetVideoMetadataUseCase(mockRepo);
    const mockMetadata = {
      tracks: [{ id: 1, language: "chi" }],
      chapters: [],
      video_info: { video_tracks: [], audio_tracks: [] },
    };
    vi.mocked(mockRepo.getVideoMetadata).mockResolvedValueOnce(
      mockMetadata as any,
    );
    const results = await useCase.execute(NonEmptyStringSchema.parse("123"), 1);
    expect(mockRepo.getVideoMetadata).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("123"),
      1,
    );
    expect(results).toEqual(mockMetadata);
  });
});
