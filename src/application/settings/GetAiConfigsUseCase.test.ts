import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { GetAiConfigsUseCase } from "./GetAiConfigsUseCase";

describe("GetAiConfigsUseCase 获取 AI 配置列表", () => {
  const rawMockRepo = { getSettings: vi.fn() };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该从设置中提取 AI 配置列表", async () => {
    const useCase = new GetAiConfigsUseCase(mockRepo);
    const configs = [
      {
        alias: "OpenAI",
        api_endpoint: "https://api.openai.com/v1",
        api_key: "test-key",
        ai_model: "gpt-4o",
      },
    ];
    vi.mocked(rawMockRepo.getSettings).mockResolvedValueOnce({
      download_dir: "/downloads",
      proxy: null,
      ai_configs: configs,
      max_download_speed: null,
      max_upload_speed: null,
      translation: {
        target_lang: "zh-CN",
        provider: "google",
        ai_config_alias: null,
      },
    });
    const result = await useCase.execute();
    expect(result).toEqual({ aiConfigs: configs });
  });

  it("ai_configs 为 null 时应该返回空数组", async () => {
    const useCase = new GetAiConfigsUseCase(mockRepo);
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
    expect(result).toEqual({ aiConfigs: [] });
  });
});
