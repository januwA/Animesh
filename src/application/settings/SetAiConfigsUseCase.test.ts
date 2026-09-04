import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { SetAiConfigsUseCase } from "./SetAiConfigsUseCase";

describe("SetAiConfigsUseCase 设置 AI 配置列表", () => {
  const rawMockRepo = { setAiConfigs: vi.fn() };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该调用 repository 的 setAiConfigs", async () => {
    const useCase = new SetAiConfigsUseCase(mockRepo);
    const configs = [
      {
        alias: NonEmptyStringSchema.parse("DeepSeek"),
        api_endpoint: NonEmptyStringSchema.parse("https://api.deepseek.com/v1"),
        api_key: NonEmptyStringSchema.parse("sk-test"),
        ai_model: NonEmptyStringSchema.parse("deepseek-chat"),
      },
    ];
    vi.mocked(rawMockRepo.setAiConfigs).mockResolvedValueOnce(undefined);
    await useCase.execute(configs);
    expect(rawMockRepo.setAiConfigs).toHaveBeenCalledWith(configs);
  });
});
