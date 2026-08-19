import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { resetAppStores } from "@/test/store-reset";
import type { UseSettingsPageDeps } from "./useSettingsPage";
import { useSettingsPage } from "./useSettingsPage";

const makeConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  alias: NonEmptyStringSchema.parse("DeepSeek"),
  api_endpoint: NonEmptyStringSchema.parse("http://127.0.0.1:11434/v1"),
  api_key: NonEmptyStringSchema.parse("sk-test"),
  ai_model: NonEmptyStringSchema.parse("deepseek-chat"),
  ...overrides,
});

const makeDeps = (
  overrides: Partial<UseSettingsPageDeps> = {},
): UseSettingsPageDeps => ({
  getSettingsUseCase: {
    execute: vi.fn().mockResolvedValue({
      download_dir: "/data",
      proxy: "http://127.0.0.1:7890",
      max_download_speed: 100,
      max_upload_speed: 200,
      ai_configs: [],
    }),
  },
  getCurrentVersionUseCase: {
    execute: vi.fn().mockResolvedValue("0.0.0"),
  },
  openUpdateUrlUseCase: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
  saveSettingsUseCase: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
  selectDirectoryUseCase: {
    execute: vi.fn().mockResolvedValue(null),
  },
  checkUpdateUseCase: {
    execute: vi.fn().mockResolvedValue({
      hasUpdate: false,
      latestVersion: "0.0.0",
      currentVersion: "0.0.0",
      notes: "",
      htmlUrl: "",
    }),
  },
  verifyAiConnectionUseCase: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
  clearCacheUseCase: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
  ...overrides,
});

const renderPage = (overrides: Partial<UseSettingsPageDeps> = {}) => {
  const deps = makeDeps(overrides);
  const hook = renderHook(() => useSettingsPage(deps));
  return { result: hook.result, deps };
};

const submit = (handler: (e: React.SubmitEvent) => void) => {
  handler({ preventDefault: vi.fn() } as unknown as React.SubmitEvent);
};

describe("useSettingsPage 设置页面 hook", () => {
  beforeEach(() => {
    resetAppStores();
    vi.clearAllMocks();
  });

  it("加载设置成功后应该填充表单状态与快照", async () => {
    const { result } = renderPage({
      getSettingsUseCase: {
        execute: vi.fn().mockResolvedValue({
          download_dir: "/data",
          proxy: "http://127.0.0.1:7890",
          max_download_speed: 100,
          max_upload_speed: 200,
          ai_configs: [makeConfig()],
        }),
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.form.storage.downloadDir).toBe("/data");
    expect(result.current.form.storage.proxy).toBe("http://127.0.0.1:7890");
    expect(result.current.form.storage.maxDownloadSpeed).toBe(100);
    expect(result.current.form.storage.maxUploadSpeed).toBe(200);
    expect(result.current.form.ai.aiConfigs).toHaveLength(1);
    expect(result.current.isDirty).toBe(false);
  });

  it("加载设置失败时应该提示错误并关闭加载状态", async () => {
    const { result } = renderPage({
      getSettingsUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("Get settings failed")),
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(toast.error).toHaveBeenCalledWith(
      "加载设置失败: Get settings failed",
    );
  });

  it("保存设置成功时应该执行用例、更新快照并清空脏状态", async () => {
    const { result, deps } = renderPage();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.form.storage.setDownloadDir("D:\\New"));
    expect(result.current.isDirty).toBe(true);

    act(() => submit(result.current.handleSave));

    await waitFor(() => expect(result.current.actions.saving).toBe(false));

    expect(deps.saveSettingsUseCase.execute).toHaveBeenCalledWith({
      downloadDir: "D:\\New",
      proxy: "http://127.0.0.1:7890",
      aiConfigs: [],
      maxDownloadSpeed: 100,
      maxUploadSpeed: 200,
    });
    expect(toast.success).toHaveBeenCalledWith(
      "设置已保存，后续下载任务将使用新路径",
    );
    expect(result.current.isDirty).toBe(false);
  });

  it("保存时速度为 0 时应转换为 null 传递", async () => {
    const { result, deps } = renderPage();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.form.storage.setMaxDownloadSpeed(0));
    act(() => result.current.form.storage.setMaxUploadSpeed(0));
    act(() => submit(result.current.handleSave));

    await waitFor(() => expect(result.current.actions.saving).toBe(false));

    expect(deps.saveSettingsUseCase.execute).toHaveBeenCalledWith({
      downloadDir: "/data",
      proxy: "http://127.0.0.1:7890",
      aiConfigs: [],
      maxDownloadSpeed: null,
      maxUploadSpeed: null,
    });
  });

  it("保存时下载目录为空应该拦截并提示", async () => {
    const { result, deps } = renderPage();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.form.storage.setDownloadDir("  "));
    act(() => submit(result.current.handleSave));

    expect(deps.saveSettingsUseCase.execute).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("下载目录不能为空");
  });

  it("保存时代理格式不正确应该拦截并提示", async () => {
    const { result, deps } = renderPage();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.form.storage.setProxy("不合法代理"));
    act(() => submit(result.current.handleSave));

    expect(deps.saveSettingsUseCase.execute).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "代理格式不正确，支持 http/https/socks5 协议或 host:port 格式",
    );
  });

  it("选择目录成功时应该更新表单目录并提示", async () => {
    const { result } = renderPage({
      selectDirectoryUseCase: {
        execute: vi.fn().mockResolvedValue("/selected"),
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.actions.handleSelectDir());

    await waitFor(() =>
      expect(result.current.form.storage.downloadDir).toBe("/selected"),
    );

    expect(toast.success).toHaveBeenCalledWith("已选择目录，点击保存以生效");
  });

  it("打开 GitHub 链接成功时应该执行打开用例", async () => {
    const { result, deps } = renderPage({
      checkUpdateUseCase: {
        execute: vi.fn().mockResolvedValue({
          hasUpdate: true,
          latestVersion: "1.0.0",
          currentVersion: "0.0.0",
          notes: "新功能",
          htmlUrl: "https://github.com/animesh/releases/1.0.0",
        }),
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.actions.handleCheckUpdate());
    await waitFor(() =>
      expect(result.current.actions.updateResult?.hasUpdate).toBe(true),
    );

    act(() => {
      void result.current.handleOpenGithub();
    });

    await waitFor(() =>
      expect(deps.openUpdateUrlUseCase.execute).toHaveBeenCalledWith(
        "https://github.com/animesh/releases/1.0.0",
      ),
    );
  });

  it("打开 GitHub 链接失败时应该提示错误", async () => {
    const { result } = renderPage({
      checkUpdateUseCase: {
        execute: vi.fn().mockResolvedValue({
          hasUpdate: true,
          latestVersion: "1.0.0",
          currentVersion: "0.0.0",
          notes: "新功能",
          htmlUrl: "https://github.com/animesh/releases/1.0.0",
        }),
      },
      openUpdateUrlUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("Open failed")),
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.actions.handleCheckUpdate());
    await waitFor(() =>
      expect(result.current.actions.updateResult?.hasUpdate).toBe(true),
    );

    act(() => {
      void result.current.handleOpenGithub();
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("无法打开链接: Open failed"),
    );
  });

  it("没有 htmlUrl 时打开 GitHub 不应执行任何操作", async () => {
    const { result, deps } = renderPage({
      checkUpdateUseCase: {
        execute: vi.fn().mockResolvedValue({
          hasUpdate: true,
          latestVersion: "1.0.0",
          currentVersion: "0.0.0",
          notes: "新功能",
          htmlUrl: "",
        }),
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.actions.handleCheckUpdate());
    await waitFor(() =>
      expect(result.current.actions.updateResult?.hasUpdate).toBe(true),
    );

    act(() => {
      void result.current.handleOpenGithub();
    });

    expect(deps.openUpdateUrlUseCase.execute).not.toHaveBeenCalled();
  });

  it("测试当前连接时地址为空应该提示警告", async () => {
    const { result } = renderPage();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.form.ai.handleStartAdd());
    act(() => result.current.handleTestCurrentConnection());

    expect(toast.warning).toHaveBeenCalledWith("请输入 AI 接口地址");
  });

  it("测试当前连接时密钥为空应该提示警告", async () => {
    const { result } = renderPage();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.form.ai.handleStartAdd());
    act(() =>
      result.current.form.ai.setApiEndpointInput("http://localhost:11434"),
    );
    act(() => result.current.handleTestCurrentConnection());

    expect(toast.warning).toHaveBeenCalledWith("请输入 API 密钥");
  });

  it("测试当前连接成功时应该提示成功", async () => {
    const { result } = renderPage();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.form.ai.handleStartAdd());
    act(() => result.current.form.ai.setAliasInput("Ollama"));
    act(() =>
      result.current.form.ai.setApiEndpointInput("http://localhost:11434"),
    );
    act(() => result.current.form.ai.setApiKeyInput("sk-123"));
    act(() => result.current.form.ai.setModelInput("llama3"));
    act(() => result.current.handleTestCurrentConnection());

    await waitFor(() => expect(result.current.actions.testingAi).toBe(false));

    expect(toast.success).toHaveBeenCalledWith("AI 模型连接测试成功！");
  });

  it("测试当前连接失败时应该提示错误", async () => {
    const { result } = renderPage({
      verifyAiConnectionUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("AI failed")),
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.form.ai.handleStartAdd());
    act(() => result.current.form.ai.setAliasInput("Ollama"));
    act(() =>
      result.current.form.ai.setApiEndpointInput("http://localhost:11434"),
    );
    act(() => result.current.form.ai.setApiKeyInput("sk-123"));
    act(() => result.current.form.ai.setModelInput("llama3"));
    act(() => result.current.handleTestCurrentConnection());

    await waitFor(() => expect(result.current.actions.testingAi).toBe(false));

    expect(toast.error).toHaveBeenCalledWith("AI 模型连接测试失败: AI failed", {
      duration: 5000,
    });
  });

  it("Web 模式下 isTauri 应该为 false 且不加载版本", async () => {
    vi.stubEnv("MODE", "web");
    const { result } = renderPage();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isTauri).toBe(false);
    expect(result.current.currentVersion).toBe("");
  });

  it("移动端环境时 isMobile 应该为 true", async () => {
    const userAgentSpy = vi
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue("Mozilla Android 13");

    const { result } = renderPage();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isMobile).toBe(true);

    userAgentSpy.mockRestore();
  });
});
