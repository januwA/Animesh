import { Background, WithValue } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { ResolveTorrentUseCase } from "./ResolveTorrentUseCase";

describe("ResolveTorrentUseCase 解析种子", () => {
  const mockRepo = {
    addTorrentMagnet: vi.fn(),
    getTorrentFiles: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该在提供 magnet 时正确调用 repository 的 addTorrentMagnet 方法并返回结果", async () => {
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
    });
    expect(mockRepo.addTorrentMagnet).toHaveBeenCalledWith(
      ctx,
      "magnet:?xt=urn:btih:123",
    );
    expect(result).toEqual(mockResult);
  });

  it("应该在只提供 infoHash 时正确调用 repository 的 getTorrentFiles 方法并组合返回结果", async () => {
    const useCase = new ResolveTorrentUseCase(mockRepo);
    const ctx = WithValue(Background, "traceId", "test-trace");
    const mockFiles = [
      { id: 1, name: NonEmptyStringSchema.parse("file1.mp4"), len: 100 },
    ];
    vi.mocked(mockRepo.getTorrentFiles).mockResolvedValueOnce(mockFiles);

    const result = await useCase.execute(ctx, {
      infoHash: NonEmptyStringSchema.parse("123"),
    });
    expect(mockRepo.getTorrentFiles).toHaveBeenCalledWith("123");
    expect(result).toEqual({
      info_hash: NonEmptyStringSchema.parse("123"),
      files: mockFiles,
    });
  });

  it("在没有提供 magnet 和 infoHash 时应该抛出错误", async () => {
    const useCase = new ResolveTorrentUseCase(mockRepo);
    const ctx = WithValue(Background, "traceId", "test-trace");
    await expect(useCase.execute(ctx, {})).rejects.toThrow(
      "未提供有效的磁力链接或种子 Hash",
    );
  });
});
