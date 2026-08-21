import { Bot } from "lucide-react";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { AiConfigForm } from "./AiConfigForm";
import { AiConfigList } from "./AiConfigList";

export interface AiSettingsSectionProps {
  aiConfigs: AiConfig[];
  editingIndex: number | null;
  aliasInput: string;
  apiEndpointInput: string;
  apiKeyInput: string;
  modelInput: string;
  testingAi: boolean;
  onAliasInputChange: (value: string) => void;
  onApiEndpointInputChange: (value: string) => void;
  onApiKeyInputChange: (value: string) => void;
  onModelInputChange: (value: string) => void;
  onTestConfig: (config: AiConfig) => void;
  onStartAdd: () => void;
  onStartEdit: (index: number) => void;
  onCancelEdit: () => void;
  onDeleteConfig: (index: number) => void;
  onSaveConfig: () => void;
  onTestCurrentConnection: () => void;
}

export function AiSettingsSection({
  aiConfigs,
  editingIndex,
  aliasInput,
  apiEndpointInput,
  apiKeyInput,
  modelInput,
  testingAi,
  onAliasInputChange,
  onApiEndpointInputChange,
  onApiKeyInputChange,
  onModelInputChange,
  onTestConfig,
  onStartAdd,
  onStartEdit,
  onCancelEdit,
  onDeleteConfig,
  onSaveConfig,
  onTestCurrentConnection,
}: AiSettingsSectionProps) {
  return (
    <Card className="ani-card">
      <CardHeader className="p-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Bot className="h-4 w-4 text-primary" />
          AI 智能搜索模型设置
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
        <AiConfigList
          aiConfigs={aiConfigs}
          testingAi={testingAi}
          showAddButton={editingIndex === null}
          onTest={onTestConfig}
          onEdit={onStartEdit}
          onDelete={onDeleteConfig}
          onAdd={onStartAdd}
        />

        {editingIndex !== null && (
          <AiConfigForm
            editingIndex={editingIndex}
            aiConfigs={aiConfigs}
            aliasInput={aliasInput}
            apiEndpointInput={apiEndpointInput}
            apiKeyInput={apiKeyInput}
            modelInput={modelInput}
            testingAi={testingAi}
            onAliasInputChange={onAliasInputChange}
            onApiEndpointInputChange={onApiEndpointInputChange}
            onApiKeyInputChange={onApiKeyInputChange}
            onModelInputChange={onModelInputChange}
            onTestConnection={onTestCurrentConnection}
            onCancel={onCancelEdit}
            onSave={onSaveConfig}
          />
        )}
      </CardContent>
    </Card>
  );
}
