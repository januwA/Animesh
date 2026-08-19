import { Bot, Loader2 } from "lucide-react";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";

export interface AiConfigFormProps {
  editingIndex: number;
  aiConfigs: AiConfig[];
  aliasInput: string;
  apiEndpointInput: string;
  apiKeyInput: string;
  modelInput: string;
  testingAi: boolean;
  onAliasInputChange: (value: string) => void;
  onApiEndpointInputChange: (value: string) => void;
  onApiKeyInputChange: (value: string) => void;
  onModelInputChange: (value: string) => void;
  onTestConnection: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function AiConfigForm({
  editingIndex,
  aiConfigs,
  aliasInput,
  apiEndpointInput,
  apiKeyInput,
  modelInput,
  testingAi,
  onAliasInputChange,
  onApiEndpointInputChange,
  onApiKeyInputChange,
  onModelInputChange,
  onTestConnection,
  onCancel,
  onSave,
}: AiConfigFormProps) {
  return (
    <div className="flex flex-col gap-4 pt-3 border-t border-border animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="font-semibold text-xs text-foreground mb-1">
        {editingIndex === -1
          ? "添加 AI 配置"
          : `编辑 AI 配置: ${aiConfigs[editingIndex]?.alias}`}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="ai-alias-input"
            className="text-muted-foreground font-medium"
          >
            配置别名 (Alias) *
          </label>
          <Input
            id="ai-alias-input"
            value={aliasInput}
            onChange={(e) => onAliasInputChange(e.target.value)}
            placeholder="例如: Ollama / DeepSeek"
            className="bg-secondary/30 border-border text-foreground py-4 text-xs"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="ai-endpoint-input"
            className="text-muted-foreground font-medium"
          >
            AI 接口地址 (Endpoint) *
          </label>
          <Input
            id="ai-endpoint-input"
            value={apiEndpointInput}
            onChange={(e) => onApiEndpointInputChange(e.target.value)}
            placeholder="例如: http://127.0.0.1:11434/v1"
            className="bg-secondary/30 border-border text-foreground py-4 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="ai-key-input"
            className="text-muted-foreground font-medium"
          >
            API 密钥 (API Key) *
          </label>
          <Input
            id="ai-key-input"
            type="password"
            value={apiKeyInput}
            onChange={(e) => onApiKeyInputChange(e.target.value)}
            placeholder="输入您的 API Key"
            className="bg-secondary/30 border-border text-foreground py-4 text-xs"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="ai-model-input"
            className="text-muted-foreground font-medium"
          >
            模型名称 (Model)
          </label>
          <Input
            id="ai-model-input"
            value={modelInput}
            onChange={(e) => onModelInputChange(e.target.value)}
            placeholder="例如: deepseek-chat"
            className="bg-secondary/30 border-border text-foreground py-5 text-xs"
          />
        </div>
      </div>

      <div className="pt-2 flex justify-between gap-3 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onTestConnection}
          disabled={testingAi}
          className="bg-secondary/50 border-border text-foreground hover:bg-secondary text-xs flex items-center gap-1.5"
        >
          {testingAi ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <Bot className="h-3 w-3 text-primary" />
          )}
          {testingAi ? "正在测试连接..." : "测试模型连接"}
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 text-xs font-medium"
          >
            取消
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onSave}
            className="h-8 text-xs font-medium bg-primary text-primary-foreground"
          >
            保存配置
          </Button>
        </div>
      </div>
    </div>
  );
}
