import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { UpdateOnlyFilesUseCase } from "./UpdateOnlyFilesUseCase";

describe("UpdateOnlyFilesUseCase 更新仅下载文件", () => {
  const mockRepo = {
    updateOnlyFiles: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 updateOnlyFiles 方法", async () => {
    vi.mocked(mockRepo.updateOnlyFiles).mockResolvedValueOnce(undefined);
    const useCase = new UpdateOnlyFilesUseCase(mockRepo);

    await useCase.execute(NonEmptyStringSchema.parse("abc123"), [0, 2, 5]);

    expect(mockRepo.updateOnlyFiles).toHaveBeenCalledWith("abc123", [0, 2, 5]);
  });

  it("空文件列表时应调用 updateOnlyFiles 并传入空数组", async () => {
    vi.mocked(mockRepo.updateOnlyFiles).mockResolvedValueOnce(undefined);
    const useCase = new UpdateOnlyFilesUseCase(mockRepo);

    await useCase.execute(NonEmptyStringSchema.parse("hash"), []);

    expect(mockRepo.updateOnlyFiles).toHaveBeenCalledWith("hash", []);
  });

  it("repository 抛出错误时应向上传播", async () => {
    vi.mocked(mockRepo.updateOnlyFiles).mockRejectedValueOnce(
      new Error("network error"),
    );
    const useCase = new UpdateOnlyFilesUseCase(mockRepo);

    await expect(
      useCase.execute(NonEmptyStringSchema.parse("h"), [1]),
    ).rejects.toThrow("network error");
  });
});
