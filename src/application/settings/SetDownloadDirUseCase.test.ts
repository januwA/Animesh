import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { SetDownloadDirUseCase } from "./SetDownloadDirUseCase";

describe("SetDownloadDirUseCase 设置下载目录", () => {
  const rawMockRepo = { setDownloadDir: vi.fn() };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该调用 repository 的 setDownloadDir", async () => {
    const useCase = new SetDownloadDirUseCase(mockRepo);
    vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
    await useCase.execute("/new/path");
    expect(rawMockRepo.setDownloadDir).toHaveBeenCalledWith("/new/path");
  });
});
