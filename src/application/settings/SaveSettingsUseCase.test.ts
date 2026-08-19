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
      downloadDir: "/mock/dir2",
      proxy: "http://127.0.0.1:1080",
      aiConfigs: [
        {
          alias: NonEmptyStringSchema.parse("OpenAI"),
          api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
          api_key: NonEmptyStringSchema.parse("test-key"),
          ai_model: NonEmptyStringSchema.parse("gpt-4o"),
        },
      ],
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

  it("在可选参数为空时应该正确忽略未提供的可选字段", async () => {
    const useCase = new SaveSettingsUseCase(mockRepo);
    vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setAiConfigs).mockResolvedValueOnce(undefined);
    await useCase.execute({
      downloadDir: "/mock/dir2",
      proxy: "http://127.0.0.1:1080",
    });
    expect(rawMockRepo.setDownloadDir).toHaveBeenCalledWith("/mock/dir2");
    expect(rawMockRepo.setProxy).toHaveBeenCalledWith("http://127.0.0.1:1080");
    expect(rawMockRepo.setAiConfigs).not.toHaveBeenCalled();
  });

  it("当 aiConfigs 为 null 时应该调用 setAiConfigs(null)", async () => {
    const useCase = new SaveSettingsUseCase(mockRepo);
    vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setAiConfigs).mockResolvedValueOnce(undefined);
    await useCase.execute({
      downloadDir: "/mock/dir2",
      proxy: "http://127.0.0.1:1080",
      aiConfigs: null,
    });
    expect(rawMockRepo.setAiConfigs).toHaveBeenCalledWith(null);
  });

  it("应该调用 setMaxUploadSpeed 方法（含 0/空值归一化）", async () => {
    const useCase = new SaveSettingsUseCase(mockRepo);
    vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    await useCase.execute({
      downloadDir: "/mock/dir2",
      proxy: "http://127.0.0.1:1080",
      maxUploadSpeed: 256,
    });
    expect(rawMockRepo.setMaxUploadSpeed).toHaveBeenCalledWith(256);
  });

  it("应该调用 setMaxDownloadSpeed 方法", async () => {
    const useCase = new SaveSettingsUseCase(mockRepo);
    vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    await useCase.execute({
      downloadDir: "/mock/dir2",
      proxy: "http://127.0.0.1:1080",
      maxDownloadSpeed: 1024,
    });
    expect(rawMockRepo.setMaxDownloadSpeed).toHaveBeenCalledWith(1024);
  });

  it("未提供 maxDownloadSpeed 时不应该调用 setMaxDownloadSpeed", async () => {
    const useCase = new SaveSettingsUseCase(mockRepo);
    vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    await useCase.execute({
      downloadDir: "/mock/dir2",
      proxy: "http://127.0.0.1:1080",
    });
    expect(rawMockRepo.setMaxDownloadSpeed).not.toHaveBeenCalled();
  });

  it("未提供 maxUploadSpeed 时不应该调用 setMaxUploadSpeed", async () => {
    const useCase = new SaveSettingsUseCase(mockRepo);
    vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    await useCase.execute({
      downloadDir: "/mock/dir2",
      proxy: "http://127.0.0.1:1080",
    });
    expect(rawMockRepo.setMaxUploadSpeed).not.toHaveBeenCalled();
  });
});
