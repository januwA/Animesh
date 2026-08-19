import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { SettingsFormSchema } from "@/domain/settings/SettingsSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";
import { useSettingsActions } from "./useSettingsActions";
import { useSettingsForm } from "./useSettingsForm";

export function useSettingsPage() {
  const { getSettingsUseCase, getCurrentVersionUseCase, openUpdateUrlUseCase } =
    useDI();
  const form = useSettingsForm();
  const actions = useSettingsActions({
    onSaveSuccess: form.markSaved,
    onDirectorySelected: form.setDownloadDir,
  });

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
    if (!form.apiEndpointInput.trim()) {
      toast.warning("请输入 AI 接口地址");
      return;
    }
    if (!form.apiKeyInput.trim()) {
      toast.warning("请输入 API 密钥");
      return;
    }
    actions.handleTestConfig({
      alias: NonEmptyStringSchema.parse(form.aliasInput),
      api_endpoint: NonEmptyStringSchema.parse(form.apiEndpointInput),
      api_key: NonEmptyStringSchema.parse(form.apiKeyInput),
      ai_model: NonEmptyStringSchema.parse(form.modelInput),
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
      downloadDir: form.downloadDir,
      proxy: form.proxy,
      aiConfigs: form.aiConfigs,
      maxDownloadSpeed: form.maxDownloadSpeed || null,
      maxUploadSpeed: form.maxUploadSpeed || null,
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
    saving: actions.saving,
    testingAi: actions.testingAi,
    checkingUpdate: actions.checkingUpdate,
    clearingCache: actions.clearingCache,
    currentVersion,
    updateResult: actions.updateResult,
    downloadDir: form.downloadDir,
    setDownloadDir: form.setDownloadDir,
    proxy: form.proxy,
    setProxy: form.setProxy,
    maxDownloadSpeed: form.maxDownloadSpeed,
    setMaxDownloadSpeed: form.setMaxDownloadSpeed,
    maxUploadSpeed: form.maxUploadSpeed,
    setMaxUploadSpeed: form.setMaxUploadSpeed,
    aiConfigs: form.aiConfigs,
    editingIndex: form.editingIndex,
    aliasInput: form.aliasInput,
    setAliasInput: form.setAliasInput,
    apiEndpointInput: form.apiEndpointInput,
    setApiEndpointInput: form.setApiEndpointInput,
    apiKeyInput: form.apiKeyInput,
    setApiKeyInput: form.setApiKeyInput,
    modelInput: form.modelInput,
    setModelInput: form.setModelInput,
    confirmClearOpen: actions.confirmClearOpen,
    setConfirmClearOpen: actions.setConfirmClearOpen,
    isDirty: form.isDirty,
    handleSave,
    handleSelectDir: actions.handleSelectDir,
    handleCheckUpdate: actions.handleCheckUpdate,
    handleOpenGithub,
    handleConfirmClearCache: actions.handleConfirmClearCache,
    handleTestConfig: actions.handleTestConfig,
    handleTestCurrentConnection,
    handleStartAdd: form.handleStartAdd,
    handleStartEdit: form.handleStartEdit,
    handleCancelEdit: form.handleCancelEdit,
    handleDeleteConfig: form.handleDeleteConfig,
    handleSaveConfig: form.handleSaveConfig,
  };
}
