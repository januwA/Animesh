import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { GetSubtitleVttUseCase } from "./GetSubtitleVttUseCase";

describe("GetSubtitleVttUseCase 获取字幕 VTT", () => {
  const mockRepo = {
    getSubtitleVtt: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 getSubtitleVtt 方法（数字轨道）", async () => {
    const mockSubtitleTranslationRepository = {
      getById: vi.fn(),
      listByTorrent: vi.fn(),
      save: vi.fn(),
      deleteById: vi.fn(),
      deleteByTorrent: vi.fn(),
      deleteByInfoHash: vi.fn(),
    };
    const useCase = new GetSubtitleVttUseCase(
      mockRepo,
      mockSubtitleTranslationRepository,
    );
    vi.mocked(mockRepo.getSubtitleVtt).mockResolvedValueOnce("WEBVTT\n...");
    const result = await useCase.execute({
      infoHash: NonEmptyStringSchema.parse("123"),
      fileId: 1,
      trackId: 2,
    });
    expect(mockRepo.getSubtitleVtt).toHaveBeenCalledWith("123", 1, 2);
    expect(result).toBe("WEBVTT\n...");
  });

  it("应该正确从 subtitleTranslationRepository 获取 AI 字幕 VTT（字符串轨道）", async () => {
    const mockSubtitleTranslationRepository = {
      getById: vi.fn().mockResolvedValue({
        id: "ai-track-123",
        vtt_content: "WEBVTT\n1\n00:00:01.000 --> 00:00:02.000\nAI 译文",
      }),
      listByTorrent: vi.fn(),
      save: vi.fn(),
      deleteById: vi.fn(),
      deleteByTorrent: vi.fn(),
      deleteByInfoHash: vi.fn(),
    };
    const useCase = new GetSubtitleVttUseCase(
      mockRepo,
      mockSubtitleTranslationRepository,
    );
    const result = await useCase.execute({
      infoHash: NonEmptyStringSchema.parse("123"),
      fileId: 1,
      trackId: "ai-track-123",
    });
    expect(mockSubtitleTranslationRepository.getById).toHaveBeenCalledWith(
      "ai-track-123",
    );
    expect(result).toBe("WEBVTT\n1\n00:00:01.000 --> 00:00:02.000\nAI 译文");
  });
});
