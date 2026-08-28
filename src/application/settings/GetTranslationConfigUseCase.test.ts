import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { GetTranslationConfigUseCase } from "./GetTranslationConfigUseCase";

describe("GetTranslationConfigUseCase 获取翻译配置", () => {
  const rawMockRepo = { getSettings: vi.fn() };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该从设置中提取翻译配置", async () => {
    const useCase = new GetTranslationConfigUseCase(mockRepo);
    vi.mocked(rawMockRepo.getSettings).mockResolvedValueOnce({
      download_dir: "/downloads",
      proxy: null,
      ai_configs: null,
      max_download_speed: null,
      max_upload_speed: null,
      translation: {
        target_lang: "en",
        provider: "ai",
        ai_config_alias: "DeepSeek",
      },
    });
    const result = await useCase.execute();
    expect(result).toEqual({
      target_lang: "en",
      provider: "ai",
      ai_config_alias: "DeepSeek",
    });
  });
});
