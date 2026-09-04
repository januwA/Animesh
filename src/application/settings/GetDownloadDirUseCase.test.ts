import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { GetDownloadDirUseCase } from "./GetDownloadDirUseCase";

describe("GetDownloadDirUseCase 获取下载目录", () => {
  const rawMockRepo = { getSettings: vi.fn() };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该从设置中提取下载目录", async () => {
    const useCase = new GetDownloadDirUseCase(mockRepo);
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
    expect(result).toEqual({ downloadDir: "/downloads" });
  });
});
