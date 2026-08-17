import { Background, WithValue } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
      keyword: "test",
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
    await useCase.execute("123");
    expect(mockRepo.pauseTorrent).toHaveBeenCalledWith("123");
  });

  it("ResumeTorrentUseCase 应该正确调用 repository 的 resumeTorrent 方法", async () => {
    const useCase = new ResumeTorrentUseCase(mockRepo);
    vi.mocked(mockRepo.resumeTorrent).mockResolvedValueOnce(undefined);
    await useCase.execute("123");
    expect(mockRepo.resumeTorrent).toHaveBeenCalledWith("123");
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
    await useCase.execute("123", true);
    expect(mockSubtitleTranslationRepo.deleteByInfoHash).toHaveBeenCalledWith(
      "123",
    );
    expect(mockRepo.deleteTorrent).toHaveBeenCalledWith("123", true);
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
    await useCase.execute("abc", false);

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
    await expect(useCase.execute("xyz", true)).rejects.toThrow("db locked");

    expect(mockRepo.deleteTorrent).not.toHaveBeenCalled();
  });

  it("GetTorrentStreamUrlUseCase 应该正确调用 repository 的 getTorrentStreamUrl 方法", async () => {
    const useCase = new GetTorrentStreamUrlUseCase(mockRepo);
    vi.mocked(mockRepo.getTorrentStreamUrl).mockResolvedValueOnce(
      "http://localhost:8080/stream/123/1",
    );
    const result = await useCase.execute("123", 1);
    expect(mockRepo.getTorrentStreamUrl).toHaveBeenCalledWith("123", 1);
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
    const results = await useCase.execute("123", 1);
    expect(mockRepo.getVideoMetadata).toHaveBeenCalledWith("123", 1);
    expect(results).toEqual(mockMetadata);
  });

  it("GetSubtitleVttUseCase 应该正确调用 repository 的 getSubtitleVtt 方法", async () => {
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
      infoHash: "123",
      fileId: 1,
      trackId: 2,
    });
    expect(mockRepo.getSubtitleVtt).toHaveBeenCalledWith("123", 1, 2);
    expect(result).toBe("WEBVTT\n...");
  });

  it("ResolveTorrentUseCase 应该在提供 magnet 时正确调用 repository 的 addTorrentMagnet 方法并返回结果", async () => {
    const useCase = new ResolveTorrentUseCase(mockRepo);
    const ctx = WithValue(Background, "traceId", "test-trace");
    const mockResult = {
      info_hash: "123",
      name: "test magnet torrent",
      files: [],
    };
    vi.mocked(mockRepo.addTorrentMagnet).mockResolvedValueOnce(mockResult);

    const result = await useCase.execute(ctx, {
      magnet: "magnet:?xt=urn:btih:123",
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
    const mockFiles = [{ id: 1, name: "file1.mp4", len: 100 }];
    vi.mocked(mockRepo.getTorrentFiles).mockResolvedValueOnce(mockFiles);

    const result = await useCase.execute(ctx, {
      infoHash: "123",
      title: "测试种子",
    });
    expect(mockRepo.getTorrentFiles).toHaveBeenCalledWith("123");
    expect(result).toEqual({
      info_hash: "123",
      name: "测试种子",
      files: mockFiles,
    });
  });

  it("ResolveTorrentUseCase 在提供 infoHash 且未提供 title 时应该使用默认的已缓存种子名称", async () => {
    const useCase = new ResolveTorrentUseCase(mockRepo);
    const ctx = WithValue(Background, "traceId", "test-trace");
    const mockFiles = [{ id: 1, name: "file1.mp4", len: 100 }];
    vi.mocked(mockRepo.getTorrentFiles).mockResolvedValueOnce(mockFiles);

    const result = await useCase.execute(ctx, { infoHash: "123" });
    expect(result).toEqual({
      info_hash: "123",
      name: "已缓存种子",
      files: mockFiles,
    });
  });

  it("ResolveTorrentUseCase 在没有提供 magnet 和 infoHash 时应该抛出错误", async () => {
    const useCase = new ResolveTorrentUseCase(mockRepo);
    const ctx = WithValue(Background, "traceId", "test-trace");
    await expect(useCase.execute(ctx, {})).rejects.toThrow(
      "未提供有效的磁力链接或种子 Hash",
    );
  });

  it("SetTorrentSubjectUseCase 应该正确调用 repository 的 setTorrentSubject 方法", async () => {
    const useCase = new SetTorrentSubjectUseCase(mockRepo);
    vi.mocked(mockRepo.setTorrentSubject).mockResolvedValueOnce(undefined);
    await useCase.execute({
      infoHash: "123",
      subjectId: 42,
      subjectName: "测试条目",
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
    await useCase.execute("123");
    expect(mockRepo.clearTorrentSubject).toHaveBeenCalledWith("123");
  });
});
