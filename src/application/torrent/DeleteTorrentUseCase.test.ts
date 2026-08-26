import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { DeleteTorrentUseCase } from "./DeleteTorrentUseCase";

describe("DeleteTorrentUseCase 删除任务", () => {
  const mockRepo = {
    deleteTorrent: vi.fn(),
  } as unknown as TorrentRepository;

  const mockSubtitleTranslationRepo = {
    deleteByInfoHash: vi.fn(),
  } as unknown as SubtitleTranslationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 deleteTorrent 方法", async () => {
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

  it("应该先删除翻译缓存再删除 torrent 任务（按顺序编排）", async () => {
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

  it("清理缓存失败时错误应向上抛出且不删除 torrent 任务", async () => {
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
});
