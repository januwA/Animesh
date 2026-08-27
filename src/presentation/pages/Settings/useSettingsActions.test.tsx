import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { useBangumiCalendarStore } from "@/presentation/store/bangumiCalendarStore";
import { useIptvStore } from "@/presentation/store/iptvStore";
import { resetAppStores } from "@/test/store-reset";
import type { UseSettingsActionsDeps } from "./useSettingsActions";
import { useSettingsActions } from "./useSettingsActions";

const makeConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  alias: NonEmptyStringSchema.parse("DeepSeek"),
  api_endpoint: NonEmptyStringSchema.parse("http://127.0.0.1:11434/v1"),
  api_key: NonEmptyStringSchema.parse("sk-test"),
  ai_model: NonEmptyStringSchema.parse("deepseek-chat"),
  ...overrides,
});

const makeDeps = (
  overrides: Partial<UseSettingsActionsDeps> = {},
): UseSettingsActionsDeps => ({
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

const renderActions = (overrides: Partial<UseSettingsActionsDeps> = {}) => {
  const onSaveSuccess = vi.fn();
  const onDirectorySelected = vi.fn();
  const deps = makeDeps(overrides);
  const hook = renderHook(() =>
    useSettingsActions({ onSaveSuccess, onDirectorySelected }, deps),
  );
  return { result: hook.result, onSaveSuccess, onDirectorySelected, deps };
};

describe("useSettingsActions 设置动作 hook", () => {
  beforeEach(() => {
    resetAppStores();
    vi.clearAllMocks();
  });

  it("保存设置成功时应该提示成功并触发 onSaveSuccess", async () => {
    const { result, deps, onSaveSuccess } = renderActions();

    act(() => {
      result.current.save({
        download_dir: "/data",
        proxy: "http://127.0.0.1:7890",
        ai_configs: [],
        max_download_speed: null,
        max_upload_speed: null,
      });
    });

    await waitFor(() => expect(result.current.saving).toBe(false));

    expect(deps.saveSettingsUseCase.execute).toHaveBeenCalledWith({
      download_dir: "/data",
      proxy: "http://127.0.0.1:7890",
      ai_configs: [],
      max_download_speed: null,
      max_upload_speed: null,
    });
    expect(toast.success).toHaveBeenCalledWith(
      "设置已保存，后续下载任务将使用新路径",
    );
    expect(onSaveSuccess).toHaveBeenCalled();
  });

  it("保存设置失败时应该提示错误", async () => {
    const { result, onSaveSuccess } = renderActions({
      saveSettingsUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("Save failed")),
      },
    });

    act(() => {
      result.current.save({
        download_dir: "/data",
        proxy: "http://127.0.0.1:7890",
        ai_configs: [],
        max_download_speed: null,
        max_upload_speed: null,
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
      selectDirectoryUseCase: {
        execute: vi.fn().mockResolvedValue("/selected"),
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
      selectDirectoryUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("Select failed")),
      },
    });

    await act(async () => {
      result.current.handleSelectDir();
    });

    expect(toast.error).toHaveBeenCalledWith("选择文件夹失败: Select failed");
  });

  it("检查更新发现新版本时应该提示新版本", async () => {
    const { result } = renderActions({
      checkUpdateUseCase: {
        execute: vi.fn().mockResolvedValue({
          hasUpdate: true,
          latestVersion: "1.0.0",
          currentVersion: "0.0.0",
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
      checkUpdateUseCase: {
        execute: vi
          .fn()
          .mockRejectedValue(
            new Error("检查更新失败", { cause: new Error("Check failed") }),
          ),
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

    expect(useBangumiCalendarStore.getState().calendar).toEqual([]);
    expect(useIptvStore.getState().iptvCountries).toEqual([]);
    expect(useIptvStore.getState().iptvChannels).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith("缓存已清理");
  });

  it("清理缓存失败时应该提示错误", async () => {
    const { result } = renderActions({
      clearCacheUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("Clear failed")),
      },
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
      verifyAiConnectionUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("AI failed")),
      },
    });

    act(() => result.current.handleTestConfig(makeConfig()));

    await waitFor(() => expect(result.current.testingAi).toBe(false));

    expect(toast.error).toHaveBeenCalledWith("AI 模型连接测试失败: AI failed", {
      duration: 5000,
    });
  });
});
