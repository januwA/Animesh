import { useTheme } from "next-themes";
import { useBlocker } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import { useAccentTheme } from "@/presentation/hooks/useAccentTheme";
import { AiSettingsSection } from "./AiSettingsSection";
import { AppearanceSection } from "./AppearanceSection";
import { CacheSettingsSection } from "./CacheSettingsSection";
import { ConfirmClearCacheDialog } from "./ConfirmClearCacheDialog";
import { ConfirmLeaveDialog } from "./ConfirmLeaveDialog";
import { NetworkSettingsSection } from "./NetworkSettingsSection";
import { SettingsActionHeader } from "./SettingsActionHeader";
import { SettingsLoading } from "./SettingsLoading";
import { StorageSettingsSection } from "./StorageSettingsSection";
import { UpdateCheckSection } from "./UpdateCheckSection";
import { useSettingsPage } from "./useSettingsPage";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccentTheme();
  const {
    getSettingsUseCase,
    getCurrentVersionUseCase,
    openUpdateUrlUseCase,
    saveSettingsUseCase,
    selectDirectoryUseCase,
    checkUpdateUseCase,
    verifyAiConnectionUseCase,
    clearCacheUseCase,
  } = useDI();
  const page = useSettingsPage({
    getSettingsUseCase,
    getCurrentVersionUseCase,
    openUpdateUrlUseCase,
    saveSettingsUseCase,
    selectDirectoryUseCase,
    checkUpdateUseCase,
    verifyAiConnectionUseCase,
    clearCacheUseCase,
  });
  const blocker = useBlocker(page.isDirty);
  const confirmLeaveOpen = blocker.state === "blocked";

  if (page.loading) {
    return <SettingsLoading />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Settings Form */}
      <form onSubmit={page.handleSave} className="flex flex-col gap-6">
        <SettingsActionHeader saving={page.actions.saving} />

        {page.isTauri && (
          <StorageSettingsSection
            downloadDir={page.form.storage.downloadDir}
            isMobile={page.isMobile}
            maxDownloadSpeed={page.form.storage.maxDownloadSpeed}
            maxUploadSpeed={page.form.storage.maxUploadSpeed}
            onDownloadDirChange={page.form.storage.setDownloadDir}
            onMaxDownloadSpeedChange={page.form.storage.setMaxDownloadSpeed}
            onMaxUploadSpeedChange={page.form.storage.setMaxUploadSpeed}
            onSelectDir={page.actions.handleSelectDir}
          />
        )}

        {page.isTauri && (
          <NetworkSettingsSection
            proxy={page.form.storage.proxy}
            onProxyChange={page.form.storage.setProxy}
          />
        )}

        <AiSettingsSection
          aiConfigs={page.form.ai.aiConfigs}
          editingIndex={page.form.ai.editingIndex}
          aliasInput={page.form.ai.aliasInput}
          apiEndpointInput={page.form.ai.apiEndpointInput}
          apiKeyInput={page.form.ai.apiKeyInput}
          modelInput={page.form.ai.modelInput}
          testingAi={page.actions.testingAi}
          onAliasInputChange={page.form.ai.setAliasInput}
          onApiEndpointInputChange={page.form.ai.setApiEndpointInput}
          onApiKeyInputChange={page.form.ai.setApiKeyInput}
          onModelInputChange={page.form.ai.setModelInput}
          onTestConfig={page.actions.handleTestConfig}
          onStartAdd={page.form.ai.handleStartAdd}
          onStartEdit={page.form.ai.handleStartEdit}
          onCancelEdit={page.form.ai.handleCancelEdit}
          onDeleteConfig={page.form.ai.handleDeleteConfig}
          onSaveConfig={page.form.ai.handleSaveConfig}
          onTestCurrentConnection={page.handleTestCurrentConnection}
        />

        <CacheSettingsSection
          clearingCache={page.actions.clearingCache}
          onClearClick={() => page.actions.setConfirmClearOpen(true)}
        />

        {page.isTauri && (
          <UpdateCheckSection
            currentVersion={page.currentVersion}
            checkingUpdate={page.actions.checkingUpdate}
            updateResult={page.actions.updateResult}
            onCheckUpdate={page.actions.handleCheckUpdate}
            onOpenGithub={page.handleOpenGithub}
          />
        )}

        <AppearanceSection
          theme={theme ?? ""}
          onThemeChange={setTheme}
          accent={accent}
          onAccentChange={setAccent}
        />
      </form>

      <ConfirmLeaveDialog
        open={confirmLeaveOpen}
        onOpenChange={(open) => !open && blocker.reset?.()}
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />

      <ConfirmClearCacheDialog
        open={page.actions.confirmClearOpen}
        clearingCache={page.actions.clearingCache}
        onOpenChange={page.actions.setConfirmClearOpen}
        onConfirm={page.actions.handleConfirmClearCache}
      />
    </div>
  );
}
