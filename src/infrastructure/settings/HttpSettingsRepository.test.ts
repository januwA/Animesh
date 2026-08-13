import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpSettingsRepository } from "./HttpSettingsRepository";

describe("基础设施层 HttpSettingsRepository", () => {
  let repository: HttpSettingsRepository;

  beforeEach(() => {
    repository = new HttpSettingsRepository();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getSettings 方法", () => {
    it("应该从 API 获取设置，并且包含 AI 配置项且返回解析后的数据", async () => {
      const mockRawSettings = {
        download_dir: "/downloads",
        proxy: "socks5://127.0.0.1:1080",
        ai_configs: [
          {
            alias: "OpenAI",
            api_endpoint: "https://api.openai.com/v1",
            api_key: "ai-api-key",
            ai_model: "gpt-4o",
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRawSettings,
      } as Response);

      const settings = await repository.getSettings();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/settings"),
        expect.objectContaining({ method: "GET" }),
      );
      expect(settings).toEqual(mockRawSettings);
    });

    it("当接口返回的数据格式不匹配 Schema 时，应该抛出错误", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ download_dir: 1234 }), // type mismatch
      } as Response);

      await expect(repository.getSettings()).rejects.toThrow(
        "Settings backend structure mismatch",
      );
    });
  });

  describe("setAiConfigs 方法", () => {
    it("应该发送 PUT 请求至 /api/settings/ai-configs 并携带正确的 JSON payload", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => "",
      } as Response);

      await repository.setAiConfigs([
        {
          alias: "OpenAI",
          api_endpoint: "https://api.openai.com/v1",
          api_key: "ai-api-key",
          ai_model: "gpt-4o",
        },
      ]);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/settings/ai-configs"),
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            configs: [
              {
                alias: "OpenAI",
                api_endpoint: "https://api.openai.com/v1",
                api_key: "ai-api-key",
                ai_model: "gpt-4o",
              },
            ],
          }),
        }),
      );
    });
  });

  describe("setMaxUploadSpeed 方法", () => {
    it("应该发送 PUT 请求至 /api/settings/max-upload-speed 并携带正确的 JSON payload", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => "",
      } as Response);

      await repository.setMaxUploadSpeed(256);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/settings/max-upload-speed"),
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ max_speed: 256 }),
        }),
      );
    });
  });
});
