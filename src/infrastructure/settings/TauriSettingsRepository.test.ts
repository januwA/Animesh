import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TauriSettingsRepository } from "./TauriSettingsRepository";

const { mockInvoke, mockSetTheme } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockSetTheme: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setTheme: mockSetTheme,
  }),
}));

describe("基础设施层 TauriSettingsRepository", () => {
  let repository: TauriSettingsRepository;

  beforeEach(() => {
    repository = new TauriSettingsRepository();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getSettings 方法", () => {
    it("应该正确从后端获取并解析设置，包含 AI 配置选项", async () => {
      const mockRawSettings = {
        download_dir: "/path/to/downloads",
        proxy: "http://127.0.0.1:7890",
        ai_configs: [
          {
            alias: "OpenAI",
            api_endpoint: "https://api.openai.com/v1",
            api_key: "test-api-key",
            ai_model: "gpt-4o",
          },
        ],
      };
      mockInvoke.mockResolvedValueOnce(mockRawSettings);

      const result = await repository.getSettings();

      expect(mockInvoke).toHaveBeenCalledWith("settings_get");
      expect(result).toEqual(mockRawSettings);
    });

    it("当后端返回的数据结构与 Schema 不匹配时，应该抛出错误", async () => {
      const mockRawSettings = {
        download_dir: 123, // 应该是 string
      };
      mockInvoke.mockResolvedValueOnce(mockRawSettings);

      await expect(repository.getSettings()).rejects.toThrow(
        "Settings backend structure mismatch",
      );
    });
  });

  describe("setAiConfigs 方法", () => {
    it("应该正确调用后端的 settings_set_ai_configs 命令", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const configs = [
        {
          alias: "OpenAI",
          api_endpoint: "https://api.openai.com/v1",
          api_key: "test-api-key",
          ai_model: "gpt-4o",
        },
      ];

      await repository.setAiConfigs(configs);

      expect(mockInvoke).toHaveBeenCalledWith("settings_set_ai_configs", {
        configs,
      });
    });
  });

  describe("setTheme 方法", () => {
    it("当传入 light 或 dark 时，应该正确加载 tauri window 并设置主题", async () => {
      mockSetTheme.mockResolvedValueOnce(undefined);
      await repository.setTheme("light");
      expect(mockSetTheme).toHaveBeenCalledWith("light");
    });

    it("当传入非 light 或 dark 选项（如 system）时，应该忽略并不调用 tauri", async () => {
      mockSetTheme.mockClear();
      await repository.setTheme("system");
      expect(mockSetTheme).not.toHaveBeenCalled();
    });
  });
});
