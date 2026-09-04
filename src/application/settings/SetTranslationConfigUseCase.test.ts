import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { SetTranslationConfigUseCase } from "./SetTranslationConfigUseCase";

describe("SetTranslationConfigUseCase 设置翻译配置", () => {
  const rawMockRepo = { setTranslationConfig: vi.fn() };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该调用 repository 的 setTranslationConfig", async () => {
    const useCase = new SetTranslationConfigUseCase(mockRepo);
    vi.mocked(rawMockRepo.setTranslationConfig).mockResolvedValueOnce(
      undefined,
    );
    await useCase.execute({
      target_lang: "ja",
      provider: "google",
      ai_config_alias: null,
    });
    expect(rawMockRepo.setTranslationConfig).toHaveBeenCalledWith({
      target_lang: "ja",
      provider: "google",
      ai_config_alias: null,
    });
  });
});
