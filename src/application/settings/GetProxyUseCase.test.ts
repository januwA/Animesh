import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { GetProxyUseCase } from "./GetProxyUseCase";

describe("GetProxyUseCase 获取代理配置", () => {
  const rawMockRepo = { getSettings: vi.fn() };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该从设置中提取代理配置", async () => {
    const useCase = new GetProxyUseCase(mockRepo);
    vi.mocked(rawMockRepo.getSettings).mockResolvedValueOnce({
      download_dir: "/downloads",
      proxy: "http://127.0.0.1:7890",
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
    expect(result).toEqual({ proxy: "http://127.0.0.1:7890" });
  });

  it("代理为 null 时应该返回 null", async () => {
    const useCase = new GetProxyUseCase(mockRepo);
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
    expect(result).toEqual({ proxy: null });
  });
});
