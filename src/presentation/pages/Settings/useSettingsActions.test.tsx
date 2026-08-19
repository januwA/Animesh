import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { vi } from "vitest";
import { DIProvider } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SettingsRepository } from "@/domain/settings/SettingsRepository";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import type { UpdateRepository } from "@/domain/update/UpdateRepository";
import { useCalendarStore } from "@/presentation/store/calendarStore";
import { useIptvStore } from "@/presentation/store/iptvStore";
import { resetAppStores } from "@/test/store-reset";
import { createDIContainerForTest } from "@/test/test-utils";
import { useSettingsActions } from "./useSettingsActions";

const makeConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  alias: NonEmptyStringSchema.parse("DeepSeek"),
  api_endpoint: NonEmptyStringSchema.parse("http://127.0.0.1:11434/v1"),
  api_key: NonEmptyStringSchema.parse("sk-test"),
  ai_model: NonEmptyStringSchema.parse("deepseek-chat"),
  ...overrides,
});

const makeSettingsRepo = (overrides: Partial<SettingsRepository> = {}) => {
  const repo = {
    getSettings: vi.fn().mockResolvedValue({ download_dir: "/data" }),
    setDownloadDir: vi.fn().mockResolvedValue(undefined),
    setProxy: vi.fn().mockResolvedValue(undefined),
    setAiConfigs: vi.fn().mockResolvedValue(undefined),
    setMaxDownloadSpeed: vi.fn().mockResolvedValue(undefined),
    setMaxUploadSpeed: vi.fn().mockResolvedValue(undefined),
    selectDirectory: vi.fn().mockResolvedValue(null),
    setTheme: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as SettingsRepository;
  return {
    repo,
    spies: repo as unknown as Record<string, ReturnType<typeof vi.fn>>,
  };
};

const makeUpdateRepo = (overrides: Partial<UpdateRepository> = {}) => {
  const repo = {
    getLatestRelease: vi.fn().mockResolvedValue({
      version: "0.0.0",
      notes: "",
      htmlUrl: "",
    }),
    getCurrentVersion: vi.fn().mockResolvedValue("0.0.0"),
    openUrl: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as UpdateRepository;
  return {
    repo,
    spies: repo as unknown as Record<string, ReturnType<typeof vi.fn>>,
  };
};

const renderActions = (
  overrides: {
    settingsRepository?: Partial<SettingsRepository>;
    updateRepository?: Partial<UpdateRepository>;
    aiClientPost?: ReturnType<typeof vi.fn>;
    clearCacheExecute?: ReturnType<typeof vi.fn>;
  } = {},
) => {
  const onSaveSuccess = vi.fn();
  const onDirectorySelected = vi.fn();
  const settings = makeSettingsRepo(overrides.settingsRepository);
  const update = makeUpdateRepo(overrides.updateRepository);
  const container = createDIContainerForTest({
    settingsRepository: settings.repo,
    updateRepository: update.repo,
    aiClient: {
      post:
        overrides.aiClientPost ?? vi.fn().mockResolvedValue({ choices: [{}] }),
    } as never,
    clearCacheUseCase: {
      execute:
        overrides.clearCacheExecute ?? vi.fn().mockResolvedValue(undefined),
    } as never,
  });
  const hook = renderHook(
    ({ onSaveSuccess, onDirectorySelected }) =>
      useSettingsActions({ onSaveSuccess, onDirectorySelected }),
    {
      initialProps: { onSaveSuccess, onDirectorySelected },
      wrapper: ({ children }) => (
        <DIProvider value={container}>{children}</DIProvider>
      ),
    },
  );
  return {
    result: hook.result,
    onSaveSuccess,
    onDirectorySelected,
    settings,
    update,
    container,
  };
};

describe("useSettingsActions 设置动作 hook", () => {
  beforeEach(() => {
    resetAppStores();
    vi.clearAllMocks();
  });

  it("保存设置成功时应该提示成功并触发 onSaveSuccess", async () => {
    const { result, settings, onSaveSuccess } = renderActions();

    act(() => {
      result.current.save({
        downloadDir: "/data",
        proxy: "http://127.0.0.1:7890",
        aiConfigs: [],
        maxDownloadSpeed: null,
        maxUploadSpeed: null,
      });
    });

    await waitFor(() => expect(result.current.saving).toBe(false));

    expect(settings.spies.setDownloadDir).toHaveBeenCalled();
    expect(settings.spies.setProxy).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      "设置已保存，后续下载任务将使用新路径",
    );
    expect(onSaveSuccess).toHaveBeenCalled();
  });

  it("保存设置失败时应该提示错误", async () => {
    const { result, onSaveSuccess } = renderActions({
      settingsRepository: {
        setDownloadDir: vi.fn().mockRejectedValue(new Error("Save failed")),
      },
    });

    act(() => {
      result.current.save({
        downloadDir: "/data",
        proxy: "http://127.0.0.1:7890",
        aiConfigs: [],
        maxDownloadSpeed: null,
        maxUploadSpeed: null,
      });
    });

    await waitFor(() => expect(result.current.saving).toBe(false));

    expect(toast.error).toHaveBeenCalledWith("保存路径失败: Save failed", {
      duration: 5000,
    });
    expect(onSaveSuccess).not.toHaveBeenCalled();
  });

  it("选择目录成功时应该更新目录并提示", async () => {
    const { result, onDirectorySelected } = renderActions({
      settingsRepository: {
        selectDirectory: vi.fn().mockResolvedValue("/selected"),
      },
    });

    await act(async () => {
      result.current.handleSelectDir();
    });

    expect(onDirectorySelected).toHaveBeenCalledWith("/selected");
    expect(toast.success).toHaveBeenCalledWith("已选择目录，点击保存以生效");
  });

  it("选择目录返回空时不做任何处理", async () => {
    const { result, onDirectorySelected } = renderActions();

    await act(async () => {
      result.current.handleSelectDir();
    });

    expect(onDirectorySelected).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalledWith(
      "已选择目录，点击保存以生效",
    );
  });

  it("选择目录失败时应该提示错误", async () => {
    const { result } = renderActions({
      settingsRepository: {
        selectDirectory: vi.fn().mockRejectedValue(new Error("Select failed")),
      },
    });

    await act(async () => {
      result.current.handleSelectDir();
    });

    expect(toast.error).toHaveBeenCalledWith("选择文件夹失败: Select failed");
  });

  it("检查更新发现新版本时应该提示新版本", async () => {
    const { result } = renderActions({
      updateRepository: {
        getLatestRelease: vi.fn().mockResolvedValue({
          version: "1.0.0",
          notes: "新功能",
          htmlUrl: "https://github.com/animesh/releases",
        }),
      },
    });

    act(() => result.current.handleCheckUpdate());

    await waitFor(() => expect(result.current.checkingUpdate).toBe(false));

    expect(toast).toHaveBeenCalledWith("发现新版本 v1.0.0");
    expect(result.current.updateResult?.hasUpdate).toBe(true);
  });

  it("检查更新没有新版本时应该提示最新", async () => {
    const { result } = renderActions();

    act(() => result.current.handleCheckUpdate());

    await waitFor(() => expect(result.current.checkingUpdate).toBe(false));

    expect(toast.success).toHaveBeenCalledWith("当前已是最新版本");
  });

  it("检查更新失败时应该提示错误", async () => {
    const { result } = renderActions({
      updateRepository: {
        getLatestRelease: vi.fn().mockRejectedValue(new Error("Check failed")),
      },
    });

    act(() => result.current.handleCheckUpdate());

    await waitFor(() => expect(result.current.checkingUpdate).toBe(false));

    expect(toast.error).toHaveBeenCalledWith(
      "检查更新失败: 检查更新失败 -> Check failed",
    );
  });

  it("清理缓存成功时应该关闭对话框、清空 store 并提示成功", async () => {
    const { result } = renderActions();

    act(() => result.current.setConfirmClearOpen(true));
    expect(result.current.confirmClearOpen).toBe(true);

    act(() => result.current.handleConfirmClearCache());

    await waitFor(() => expect(result.current.confirmClearOpen).toBe(false));

    expect(useCalendarStore.getState().calendar).toEqual([]);
    expect(useIptvStore.getState().iptvCountries).toEqual([]);
    expect(useIptvStore.getState().iptvChannels).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith("缓存已清理");
  });

  it("清理缓存失败时应该提示错误", async () => {
    const { result } = renderActions({
      clearCacheExecute: vi.fn().mockRejectedValue(new Error("Clear failed")),
    });

    act(() => result.current.handleConfirmClearCache());

    await waitFor(() => expect(result.current.clearingCache).toBe(false));

    expect(toast.error).toHaveBeenCalledWith("清理缓存失败: Clear failed");
  });

  it("测试已有配置成功时应该提示成功", async () => {
    const { result } = renderActions();

    act(() => result.current.handleTestConfig(makeConfig()));

    await waitFor(() => expect(result.current.testingAi).toBe(false));

    expect(toast.success).toHaveBeenCalledWith("AI 模型连接测试成功！");
  });

  it("测试已有配置失败时应该提示错误", async () => {
    const { result } = renderActions({
      aiClientPost: vi.fn().mockRejectedValue(new Error("AI failed")),
    });

    act(() => result.current.handleTestConfig(makeConfig()));

    await waitFor(() => expect(result.current.testingAi).toBe(false));

    expect(toast.error).toHaveBeenCalledWith("AI 模型连接测试失败: AI failed", {
      duration: 5000,
    });
  });
});
