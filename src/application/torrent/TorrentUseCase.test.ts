import { Background, WithValue } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { ClearTorrentSubjectUseCase } from "./ClearTorrentSubjectUseCase";
import { DeleteTorrentUseCase } from "./DeleteTorrentUseCase";
import { GetSubtitleVttUseCase } from "./GetSubtitleVttUseCase";
import { GetTorrentStreamUrlUseCase } from "./GetTorrentStreamUrlUseCase";
import { GetVideoMetadataUseCase } from "./GetVideoMetadataUseCase";
import { PauseTorrentUseCase } from "./PauseTorrentUseCase";
import { ResolveTorrentUseCase } from "./ResolveTorrentUseCase";
import { ResumeTorrentUseCase } from "./ResumeTorrentUseCase";
import { SearchTorrentsUseCase } from "./SearchTorrentsUseCase";
import { SetTorrentSubjectUseCase } from "./SetTorrentSubjectUseCase";

describe("Torrent 相关的 UseCase 业务编排", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRepo = {
    search: vi.fn(),
    pauseTorrent: vi.fn(),
    resumeTorrent: vi.fn(),
    deleteTorrent: vi.fn(),
    addTorrentMagnet: vi.fn(),
    getTorrentFiles: vi.fn(),
    getTorrentStreamUrl: vi.fn(),
    getVideoMetadata: vi.fn(),
    getSubtitleVtt: vi.fn(),
    setTorrentSubject: vi.fn(),
    clearTorrentSubject: vi.fn(),
    subscribeTorrents: vi.fn().mockResolvedValue(() => {}),
  } as unknown as TorrentRepository;

  const mockSubtitleTranslationRepo = {
    getById: vi.fn(),
    listByTorrent: vi.fn(),
    save: vi.fn(),
    deleteById: vi.fn(),
    deleteByTorrent: vi.fn(),
    deleteByInfoHash: vi.fn(),
  } as unknown as SubtitleTranslationRepository;

  it("SearchTorrentsUseCase 应该正确调用 repository 的 search 方法", async () => {
    const useCase = new SearchTorrentsUseCase(mockRepo);
    vi.mocked(mockRepo.search).mockResolvedValueOnce([
      { name: "test anime", magnet: "magnet:?xt=urn:btih:123" } as any,
    ]);
    const ctx = WithValue(Background, "traceId", "test-trace");
    const results = await useCase.execute(ctx, {
      keyword: NonEmptyStringSchema.parse("test"),
      engine: "mikan",
    });
    expect(mockRepo.search).toHaveBeenCalledWith(ctx, "test", "mikan");
    expect(results).toEqual([
      { name: "test anime", magnet: "magnet:?xt=urn:btih:123" },
    ]);
  });

  it("PauseTorrentUseCase 应该正确调用 repository 的 pauseTorrent 方法", async () => {
    const useCase = new PauseTorrentUseCase(mockRepo);
    vi.mocked(mockRepo.pauseTorrent).mockResolvedValueOnce(undefined);
    await useCase.execute(NonEmptyStringSchema.parse("123"));
    expect(mockRepo.pauseTorrent).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("123"),
    );
  });

  it("ResumeTorrentUseCase 应该正确调用 repository 的 resumeTorrent 方法", async () => {
    const useCase = new ResumeTorrentUseCase(mockRepo);
    vi.mocked(mockRepo.resumeTorrent).mockResolvedValueOnce(undefined);
    await useCase.execute(NonEmptyStringSchema.parse("123"));
    expect(mockRepo.resumeTorrent).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("123"),
    );
  });

  it("DeleteTorrentUseCase 应该正确调用 repository 的 deleteTorrent 方法", async () => {
    const useCase = new DeleteTorrentUseCase(
      mockRepo,
      mockSubtitleTranslationRepo,
    );
    vi.mocked(mockRepo.deleteTorrent).mockResolvedValueOnce(undefined);
    vi.mocked(
      mockSubtitleTranslationRepo.deleteByInfoHash,
    ).mockResolvedValueOnce(0);
    await useCase.execute(NonEmptyStringSchema.parse("123"), true);
    expect(mockSubtitleTranslationRepo.deleteByInfoHash).toHaveBeenCalledWith(
      "123",
    );
    expect(mockRepo.deleteTorrent).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("123"),
      true,
    );
  });

  it("DeleteTorrentUseCase 应该先删除翻译缓存再删除 torrent 任务（按顺序编排）", async () => {
    const callOrder: string[] = [];
    vi.mocked(
      mockSubtitleTranslationRepo.deleteByInfoHash,
    ).mockImplementationOnce(async () => {
      callOrder.push("deleteByInfoHash");
      return 3;
    });
    vi.mocked(mockRepo.deleteTorrent).mockImplementationOnce(async () => {
      callOrder.push("deleteTorrent");
    });

    const useCase = new DeleteTorrentUseCase(
      mockRepo,
      mockSubtitleTranslationRepo,
    );
    await useCase.execute(NonEmptyStringSchema.parse("abc"), false);

    expect(callOrder).toEqual(["deleteByInfoHash", "deleteTorrent"]);
    expect(mockSubtitleTranslationRepo.deleteByInfoHash).toHaveBeenCalledWith(
      "abc",
    );
    expect(mockRepo.deleteTorrent).toHaveBeenCalledWith("abc", false);
  });

  it("DeleteTorrentUseCase 清理缓存失败时错误应向上抛出且不删除 torrent 任务", async () => {
    vi.mocked(
      mockSubtitleTranslationRepo.deleteByInfoHash,
    ).mockRejectedValueOnce(new Error("db locked"));
    vi.mocked(mockRepo.deleteTorrent).mockResolvedValueOnce(undefined);

    const useCase = new DeleteTorrentUseCase(
      mockRepo,
      mockSubtitleTranslationRepo,
    );
    await expect(
      useCase.execute(NonEmptyStringSchema.parse("xyz"), true),
    ).rejects.toThrow("db locked");

    expect(mockRepo.deleteTorrent).not.toHaveBeenCalled();
  });

  it("GetTorrentStreamUrlUseCase 应该正确调用 repository 的 getTorrentStreamUrl 方法", async () => {
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

  it("GetVideoMetadataUseCase 应该正确调用 repository 的 getVideoMetadata 方法", async () => {
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

  it("GetSubtitleVttUseCase 应该正确调用 repository 的 getSubtitleVtt 方法（数字轨道）", async () => {
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

  it("GetSubtitleVttUseCase 应该正确从 subtitleTranslationRepository 获取 AI 字幕 VTT（字符串轨道）", async () => {
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

  it("ResolveTorrentUseCase 应该在提供 magnet 时正确调用 repository 的 addTorrentMagnet 方法并返回结果", async () => {
    const useCase = new ResolveTorrentUseCase(mockRepo);
    const ctx = WithValue(Background, "traceId", "test-trace");
    const mockResult = {
      info_hash: NonEmptyStringSchema.parse("123"),
      name: NonEmptyStringSchema.parse("test magnet torrent"),
      files: [],
    };
    vi.mocked(mockRepo.addTorrentMagnet).mockResolvedValueOnce(mockResult);

    const result = await useCase.execute(ctx, {
      magnet: NonEmptyStringSchema.parse("magnet:?xt=urn:btih:123"),
      title: NonEmptyStringSchema.parse("测试 magnet torrent"),
    });
    expect(mockRepo.addTorrentMagnet).toHaveBeenCalledWith(
      ctx,
      "magnet:?xt=urn:btih:123",
    );
    expect(result).toEqual(mockResult);
  });

  it("ResolveTorrentUseCase 应该在只提供 infoHash 时正确调用 repository 的 getTorrentFiles 方法并组合返回结果", async () => {
    const useCase = new ResolveTorrentUseCase(mockRepo);
    const ctx = WithValue(Background, "traceId", "test-trace");
    const mockFiles = [
      { id: 1, name: NonEmptyStringSchema.parse("file1.mp4"), len: 100 },
    ];
    vi.mocked(mockRepo.getTorrentFiles).mockResolvedValueOnce(mockFiles);

    const result = await useCase.execute(ctx, {
      infoHash: NonEmptyStringSchema.parse("123"),
      title: NonEmptyStringSchema.parse("测试种子"),
    });
    expect(mockRepo.getTorrentFiles).toHaveBeenCalledWith("123");
    expect(result).toEqual({
      info_hash: NonEmptyStringSchema.parse("123"),
      name: NonEmptyStringSchema.parse("测试种子"),
      files: mockFiles,
    });
  });

  it("ResolveTorrentUseCase 在没有提供 magnet 和 infoHash 时应该抛出错误", async () => {
    const useCase = new ResolveTorrentUseCase(mockRepo);
    const ctx = WithValue(Background, "traceId", "test-trace");
    await expect(
      useCase.execute(ctx, {
        title: NonEmptyStringSchema.parse("测试种子"),
      }),
    ).rejects.toThrow("未提供有效的磁力链接或种子 Hash");
  });

  it("SetTorrentSubjectUseCase 应该正确调用 repository 的 setTorrentSubject 方法", async () => {
    const useCase = new SetTorrentSubjectUseCase(mockRepo);
    vi.mocked(mockRepo.setTorrentSubject).mockResolvedValueOnce(undefined);
    await useCase.execute({
      infoHash: NonEmptyStringSchema.parse("123"),
      subjectId: 42,
      subjectName: NonEmptyStringSchema.parse("测试条目"),
    });
    expect(mockRepo.setTorrentSubject).toHaveBeenCalledWith(
      "123",
      42,
      "测试条目",
    );
  });

  it("ClearTorrentSubjectUseCase 应该正确调用 repository 的 clearTorrentSubject 方法", async () => {
    const useCase = new ClearTorrentSubjectUseCase(mockRepo);
    vi.mocked(mockRepo.clearTorrentSubject).mockResolvedValueOnce(undefined);
    await useCase.execute(NonEmptyStringSchema.parse("123"));
    expect(mockRepo.clearTorrentSubject).toHaveBeenCalledWith("123");
  });
});
