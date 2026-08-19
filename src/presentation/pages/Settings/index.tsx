import { useTheme } from "next-themes";
import { useBlocker } from "react-router-dom";
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
  const page = useSettingsPage();
  const blocker = useBlocker(page.isDirty);
  const confirmLeaveOpen = blocker.state === "blocked";

  if (page.loading) {
    return <SettingsLoading />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Settings Form */}
      <form onSubmit={page.handleSave} className="flex flex-col gap-6">
        <SettingsActionHeader saving={page.saving} />

        {page.isTauri && (
          <StorageSettingsSection
            downloadDir={page.downloadDir}
            isMobile={page.isMobile}
            maxDownloadSpeed={page.maxDownloadSpeed}
            maxUploadSpeed={page.maxUploadSpeed}
            onDownloadDirChange={page.setDownloadDir}
            onMaxDownloadSpeedChange={page.setMaxDownloadSpeed}
            onMaxUploadSpeedChange={page.setMaxUploadSpeed}
            onSelectDir={page.handleSelectDir}
          />
        )}

        {page.isTauri && (
          <NetworkSettingsSection
            proxy={page.proxy}
            onProxyChange={page.setProxy}
          />
        )}

        <AiSettingsSection
          aiConfigs={page.aiConfigs}
          editingIndex={page.editingIndex}
          aliasInput={page.aliasInput}
          apiEndpointInput={page.apiEndpointInput}
          apiKeyInput={page.apiKeyInput}
          modelInput={page.modelInput}
          testingAi={page.testingAi}
          onAliasInputChange={page.setAliasInput}
          onApiEndpointInputChange={page.setApiEndpointInput}
          onApiKeyInputChange={page.setApiKeyInput}
          onModelInputChange={page.setModelInput}
          onTestConfig={page.handleTestConfig}
          onStartAdd={page.handleStartAdd}
          onStartEdit={page.handleStartEdit}
          onCancelEdit={page.handleCancelEdit}
          onDeleteConfig={page.handleDeleteConfig}
          onSaveConfig={page.handleSaveConfig}
          onTestCurrentConnection={page.handleTestCurrentConnection}
        />

        <CacheSettingsSection
          clearingCache={page.clearingCache}
          onClearClick={() => page.setConfirmClearOpen(true)}
        />

        {page.isTauri && (
          <UpdateCheckSection
            currentVersion={page.currentVersion}
            checkingUpdate={page.checkingUpdate}
            updateResult={page.updateResult}
            onCheckUpdate={page.handleCheckUpdate}
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
        open={page.confirmClearOpen}
        clearingCache={page.clearingCache}
        onOpenChange={page.setConfirmClearOpen}
        onConfirm={page.handleConfirmClearCache}
      />
    </div>
  );
}
