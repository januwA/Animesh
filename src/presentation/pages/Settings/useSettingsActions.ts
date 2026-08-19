import { useState } from "react";
import { toast } from "sonner";
import type { ClearCacheUseCase } from "@/application/cache/ClearCacheUseCase";
import type {
  SaveSettingsDto,
  SaveSettingsUseCase,
} from "@/application/settings/SaveSettingsUseCase";
import type { SelectDirectoryUseCase } from "@/application/settings/SelectDirectoryUseCase";
import type { VerifyAiConnectionUseCase } from "@/application/settings/VerifyAiConnectionUseCase";
import type { CheckUpdateUseCase } from "@/application/update/CheckUpdateUseCase";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useCalendarStore } from "@/presentation/store/calendarStore";
import { useIptvStore } from "@/presentation/store/iptvStore";
import { formatError } from "@/utils";

export interface UseSettingsActionsOptions {
  onSaveSuccess: () => void;
  onDirectorySelected: (dir: string) => void;
}

/** useSettingsActions 的依赖，由调用方（页面组合根）注入 */
export interface UseSettingsActionsDeps {
  saveSettingsUseCase: Pick<SaveSettingsUseCase, "execute">;
  selectDirectoryUseCase: Pick<SelectDirectoryUseCase, "execute">;
  checkUpdateUseCase: Pick<CheckUpdateUseCase, "execute">;
  verifyAiConnectionUseCase: Pick<VerifyAiConnectionUseCase, "execute">;
  clearCacheUseCase: Pick<ClearCacheUseCase, "execute">;
}

export function useSettingsActions(
  { onSaveSuccess, onDirectorySelected }: UseSettingsActionsOptions,
  deps: UseSettingsActionsDeps,
) {
  const {
    saveSettingsUseCase,
    selectDirectoryUseCase,
    checkUpdateUseCase,
    verifyAiConnectionUseCase,
    clearCacheUseCase,
  } = deps;
  const setCalendar = useCalendarStore((s) => s.setCalendar);
  const setIptvCountries = useIptvStore((s) => s.setIptvCountries);
  const setIptvChannels = useIptvStore((s) => s.setIptvChannels);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const verifyAiMutation = useMutation(
    (_ctx, config: AiConfig) => verifyAiConnectionUseCase.execute(config),
    {
      onSuccess: () => toast.success("AI 模型连接测试成功！"),
      onError: (err) =>
        toast.error(`AI 模型连接测试失败: ${formatError(err)}`, {
          duration: 5000,
        }),
    },
  );
  const testingAi = verifyAiMutation.loading;
  const handleTestConfig = (config: AiConfig) => {
    verifyAiMutation.execute(config);
  };

  const checkUpdateMutation = useMutation(() => checkUpdateUseCase.execute(), {
    onSuccess: (result) => {
      if (result.hasUpdate) {
        toast(`发现新版本 v${result.latestVersion}`);
      } else {
        toast.success("当前已是最新版本");
      }
    },
    onError: (err) => toast.error(`检查更新失败: ${formatError(err)}`),
  });
  const checkingUpdate = checkUpdateMutation.loading;
  const updateResult = checkUpdateMutation.data;
  const handleCheckUpdate = () => {
    checkUpdateMutation.execute();
  };

  const clearCacheMutation = useMutation(() => clearCacheUseCase.execute(), {
    onSuccess: () => {
      setCalendar([]);
      setIptvCountries([]);
      setIptvChannels([]);
      setConfirmClearOpen(false);
      toast.success("缓存已清理");
    },
    onError: (err) => toast.error(`清理缓存失败: ${formatError(err)}`),
  });
  const clearingCache = clearCacheMutation.loading;
  const handleConfirmClearCache = () => {
    clearCacheMutation.execute();
  };

  const selectDirMutation = useMutation(
    () => selectDirectoryUseCase.execute(),
    {
      onSuccess: (selected) => {
        if (selected) {
          onDirectorySelected(selected);
          toast.success("已选择目录，点击保存以生效");
        }
      },
      onError: (err) => toast.error(`选择文件夹失败: ${formatError(err)}`),
    },
  );
  const handleSelectDir = () => {
    selectDirMutation.execute();
  };

  const saveMutation = useMutation(
    (_ctx, data: SaveSettingsDto) => saveSettingsUseCase.execute(data),
    {
      onSuccess: () => {
        toast.success("设置已保存，后续下载任务将使用新路径");
        onSaveSuccess();
      },
      onError: (err) =>
        toast.error(`保存路径失败: ${formatError(err)}`, { duration: 5000 }),
    },
  );
  const saving = saveMutation.loading;
  const save = (data: SaveSettingsDto) => {
    saveMutation.execute(data);
  };

  return {
    testingAi,
    checkingUpdate,
    clearingCache,
    saving,
    updateResult,
    confirmClearOpen,
    setConfirmClearOpen,
    handleTestConfig,
    handleCheckUpdate,
    handleConfirmClearCache,
    handleSelectDir,
    save,
  };
}
