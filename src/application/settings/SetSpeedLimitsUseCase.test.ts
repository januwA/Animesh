import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { SetSpeedLimitsUseCase } from "./SetSpeedLimitsUseCase";

describe("SetSpeedLimitsUseCase 设置速度限制", () => {
  const rawMockRepo = {
    setMaxDownloadSpeed: vi.fn(),
    setMaxUploadSpeed: vi.fn(),
  };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该调用 setMaxDownloadSpeed 和 setMaxUploadSpeed", async () => {
    const useCase = new SetSpeedLimitsUseCase(mockRepo);
    vi.mocked(rawMockRepo.setMaxDownloadSpeed).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setMaxUploadSpeed).mockResolvedValueOnce(undefined);
    await useCase.execute(1024, 512);
    expect(rawMockRepo.setMaxDownloadSpeed).toHaveBeenCalledWith(1024);
    expect(rawMockRepo.setMaxUploadSpeed).toHaveBeenCalledWith(512);
  });
});
