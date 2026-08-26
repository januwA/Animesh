import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { GetSettingsUseCase } from "./GetSettingsUseCase";

describe("GetSettingsUseCase 获取配置选项", () => {
  const rawMockRepo = {
    getSettings: vi.fn(),
  };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确获取配置选项", async () => {
    const useCase = new GetSettingsUseCase(mockRepo);
    vi.mocked(rawMockRepo.getSettings).mockResolvedValueOnce({
      download_dir: "/mock/dir",
      proxy: null,
      ai_configs: [
        {
          alias: "OpenAI",
          api_endpoint: "https://api.openai.com/v1",
          api_key: "test-key",
          ai_model: "gpt-4o",
        },
      ],
    });
    const result = await useCase.execute();
    expect(rawMockRepo.getSettings).toHaveBeenCalled();
    expect(result).toEqual({
      download_dir: "/mock/dir",
      proxy: null,
      ai_configs: [
        {
          alias: "OpenAI",
          api_endpoint: "https://api.openai.com/v1",
          api_key: "test-key",
          ai_model: "gpt-4o",
        },
      ],
    });
  });
});
