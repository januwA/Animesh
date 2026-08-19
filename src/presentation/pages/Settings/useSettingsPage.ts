import { toast } from "sonner";
import type { GetSettingsUseCase } from "@/application/settings/GetSettingsUseCase";
import type { GetCurrentVersionUseCase } from "@/application/update/GetCurrentVersionUseCase";
import type { OpenUpdateUrlUseCase } from "@/application/update/OpenUpdateUrlUseCase";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { SettingsFormSchema } from "@/domain/settings/SettingsSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";
import type { UseSettingsActionsDeps } from "./useSettingsActions";
import { useSettingsActions } from "./useSettingsActions";
import { useSettingsForm } from "./useSettingsForm";

/** useSettingsPage 的依赖，由调用方（页面组合根）注入 */
export interface UseSettingsPageDeps extends UseSettingsActionsDeps {
  getSettingsUseCase: Pick<GetSettingsUseCase, "execute">;
  getCurrentVersionUseCase: Pick<GetCurrentVersionUseCase, "execute">;
  openUpdateUrlUseCase: Pick<OpenUpdateUrlUseCase, "execute">;
}

export function useSettingsPage(deps: UseSettingsPageDeps) {
  const { getSettingsUseCase, getCurrentVersionUseCase, openUpdateUrlUseCase } =
    deps;
  const form = useSettingsForm();
  const actions = useSettingsActions(
    {
      onSaveSuccess: form.markSaved,
      onDirectorySelected: form.storage.setDownloadDir,
    },
    deps,
  );

  const isTauri = import.meta.env.MODE !== "web";
  const isMobile =
    ["android", "ios"].includes(import.meta.env.TAURI_ENV_PLATFORM || "") ||
    (typeof navigator !== "undefined" &&
      /android|iphone|ipad|ipod/i.test(navigator.userAgent));

  // Load settings
  const settingsQuery = useQuery(
    () => getSettingsUseCase.execute(),
    [getSettingsUseCase],
    {
      onSuccess: (settings) => form.applySettings(settings),
      onError: (err) => toast.error(`加载设置失败: ${formatError(err)}`),
    },
  );
  const loading = settingsQuery.loading;

  // Load version
  const versionQuery = useQuery(
    () => getCurrentVersionUseCase.execute(),
    [getCurrentVersionUseCase],
    { enabled: isTauri },
  );
  const currentVersion = versionQuery.data ?? "";

  const handleTestCurrentConnection = () => {
    if (!form.ai.apiEndpointInput.trim()) {
      toast.warning("请输入 AI 接口地址");
      return;
    }
    if (!form.ai.apiKeyInput.trim()) {
      toast.warning("请输入 API 密钥");
      return;
    }
    actions.handleTestConfig({
      alias: NonEmptyStringSchema.parse(form.ai.aliasInput),
      api_endpoint: NonEmptyStringSchema.parse(form.ai.apiEndpointInput),
      api_key: NonEmptyStringSchema.parse(form.ai.apiKeyInput),
      ai_model: NonEmptyStringSchema.parse(form.ai.modelInput),
    });
  };

  const handleOpenGithub = async () => {
    if (!actions.updateResult?.htmlUrl) return;
    try {
      await openUpdateUrlUseCase.execute(
        NonEmptyStringSchema.parse(actions.updateResult.htmlUrl),
      );
    } catch (err: unknown) {
      toast.error(`无法打开链接: ${formatError(err)}`);
    }
  };

  const handleSave = (e: React.SubmitEvent) => {
    e.preventDefault();

    const validation = SettingsFormSchema.safeParse({
      downloadDir: form.storage.downloadDir,
      proxy: form.storage.proxy,
      aiConfigs: form.ai.aiConfigs,
      maxDownloadSpeed: form.storage.maxDownloadSpeed || null,
      maxUploadSpeed: form.storage.maxUploadSpeed || null,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0].message;
      toast.error(firstError);
      return;
    }

    actions.save(validation.data);
  };

  return {
    isTauri,
    isMobile,
    loading,
    currentVersion,
    isDirty: form.isDirty,
    form,
    actions,
    handleSave,
    handleTestCurrentConnection,
    handleOpenGithub,
  };
}
