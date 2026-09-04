import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { GetSpeedLimitsUseCase } from "./GetSpeedLimitsUseCase";

describe("GetSpeedLimitsUseCase 获取速度限制", () => {
  const rawMockRepo = { getSettings: vi.fn() };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该从设置中提取速度限制", async () => {
    const useCase = new GetSpeedLimitsUseCase(mockRepo);
    vi.mocked(rawMockRepo.getSettings).mockResolvedValueOnce({
      download_dir: "/downloads",
      proxy: null,
      ai_configs: null,
      max_download_speed: 1024,
      max_upload_speed: 512,
      translation: {
        target_lang: "zh-CN",
        provider: "google",
        ai_config_alias: null,
      },
    });
    const result = await useCase.execute();
    expect(result).toEqual({
      maxDownloadSpeed: 1024,
      maxUploadSpeed: 512,
    });
  });

  it("null 值应该归一化为 0", async () => {
    const useCase = new GetSpeedLimitsUseCase(mockRepo);
    vi.mocked(rawMockRepo.getSettings).mockResolvedValueOnce({
      download_dir: "/downloads",
      proxy: null,
      ai_configs: null,
      max_download_speed: null,
      max_upload_speed: null,
      translation: {
        target_lang: "zh-CN",
        provider: "google",
        ai_config_alias: null,
      },
    });
    const result = await useCase.execute();
    expect(result).toEqual({
      maxDownloadSpeed: 0,
      maxUploadSpeed: 0,
    });
  });
});
