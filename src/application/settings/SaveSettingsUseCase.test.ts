import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { SaveSettingsUseCase } from "./SaveSettingsUseCase";

describe("SaveSettingsUseCase 保存配置", () => {
  const rawMockRepo = {
    setDownloadDir: vi.fn(),
    setProxy: vi.fn(),
    setAiConfigs: vi.fn(),
    setMaxDownloadSpeed: vi.fn(),
    setMaxUploadSpeed: vi.fn(),
    setTranslationConfig: vi.fn(),
  };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该调用 repository 里的 setDownloadDir、setProxy 方法以及 setAiConfigs 方法", async () => {
    const useCase = new SaveSettingsUseCase(mockRepo);
    vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setAiConfigs).mockResolvedValueOnce(undefined);
    await useCase.execute({
      download_dir: "/mock/dir2",
      proxy: "http://127.0.0.1:1080",
      ai_configs: [
        {
          alias: NonEmptyStringSchema.parse("OpenAI"),
          api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
          api_key: NonEmptyStringSchema.parse("test-key"),
          ai_model: NonEmptyStringSchema.parse("gpt-4o"),
        },
      ],
      max_download_speed: null,
      max_upload_speed: null,
      translation: {
        target_lang: "zh-CN",
        provider: "google" as const,
        ai_config_alias: null,
      },
    });
    expect(rawMockRepo.setDownloadDir).toHaveBeenCalledWith("/mock/dir2");
    expect(rawMockRepo.setProxy).toHaveBeenCalledWith("http://127.0.0.1:1080");
    expect(rawMockRepo.setAiConfigs).toHaveBeenCalledWith([
      {
        alias: NonEmptyStringSchema.parse("OpenAI"),
        api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
        api_key: NonEmptyStringSchema.parse("test-key"),
        ai_model: NonEmptyStringSchema.parse("gpt-4o"),
      },
    ]);
  });

  it("当 aiConfigs 为 null 时应该调用 setAiConfigs(null)", async () => {
    const useCase = new SaveSettingsUseCase(mockRepo);
    vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setAiConfigs).mockResolvedValueOnce(undefined);
    await useCase.execute({
      download_dir: "/mock/dir2",
      proxy: "http://127.0.0.1:1080",
      ai_configs: null,
      max_download_speed: null,
      max_upload_speed: null,
      translation: {
        target_lang: "zh-CN",
        provider: "google" as const,
        ai_config_alias: null,
      },
    });
    expect(rawMockRepo.setAiConfigs).toHaveBeenCalledWith(null);
  });

  it("应该调用 setMaxUploadSpeed 方法（含 0/空值归一化）", async () => {
    const useCase = new SaveSettingsUseCase(mockRepo);
    vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    await useCase.execute({
      download_dir: "/mock/dir2",
      proxy: "http://127.0.0.1:1080",
      max_upload_speed: 256,
      ai_configs: null,
      max_download_speed: null,
      translation: {
        target_lang: "zh-CN",
        provider: "google" as const,
        ai_config_alias: null,
      },
    });
    expect(rawMockRepo.setMaxUploadSpeed).toHaveBeenCalledWith(256);
  });

  it("应该调用 setMaxDownloadSpeed 方法", async () => {
    const useCase = new SaveSettingsUseCase(mockRepo);
    vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    await useCase.execute({
      download_dir: "/mock/dir2",
      proxy: "http://127.0.0.1:1080",
      max_download_speed: 1024,
      ai_configs: null,
      max_upload_speed: null,
      translation: {
        target_lang: "zh-CN",
        provider: "google" as const,
        ai_config_alias: null,
      },
    });
    expect(rawMockRepo.setMaxDownloadSpeed).toHaveBeenCalledWith(1024);
  });
});
