import { Bot, Loader2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type {
  AiConfig,
  AiConfigInput,
} from "@/domain/settings/SettingsSchemas";
import { Button } from "@/presentation/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/presentation/components/ui/field";
import { Input } from "@/presentation/components/ui/input";
import { Separator } from "@/presentation/components/ui/separator";

export interface AiConfigFormProps {
  form: UseFormReturn<AiConfigInput>;
  editingIndex: number;
  aiConfigs: AiConfig[];
  testingAi: boolean;
  onTestConnection: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function AiConfigForm({
  form,
  editingIndex,
  aiConfigs,
  testingAi,
  onTestConnection,
  onCancel,
  onSave,
}: AiConfigFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="flex flex-col gap-4 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
      <Separator />
      <div className="font-semibold text-xs text-foreground">
        {editingIndex === -1
          ? "添加 AI 配置"
          : `编辑 AI 配置: ${aiConfigs[editingIndex]?.alias}`}
      </div>

      <FieldGroup>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field data-invalid={!!errors.alias}>
            <FieldLabel htmlFor="ai-alias-input">配置别名 (Alias) *</FieldLabel>
            <Input
              id="ai-alias-input"
              {...register("alias")}
              aria-invalid={!!errors.alias}
              placeholder="例如: Ollama / DeepSeek"
            />
            {errors.alias && <FieldError>{errors.alias.message}</FieldError>}
          </Field>

          <Field data-invalid={!!errors.api_endpoint}>
            <FieldLabel htmlFor="ai-endpoint-input">
              AI 接口地址 (Endpoint) *
            </FieldLabel>
            <Input
              id="ai-endpoint-input"
              {...register("api_endpoint")}
              aria-invalid={!!errors.api_endpoint}
              placeholder="例如: http://127.0.0.1:11434/v1"
            />
            {errors.api_endpoint && (
              <FieldError>{errors.api_endpoint.message}</FieldError>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field data-invalid={!!errors.api_key}>
            <FieldLabel htmlFor="ai-key-input">API 密钥 (API Key) *</FieldLabel>
            <Input
              id="ai-key-input"
              type="password"
              {...register("api_key")}
              aria-invalid={!!errors.api_key}
              placeholder="输入您的 API Key"
            />
            {errors.api_key && (
              <FieldError>{errors.api_key.message}</FieldError>
            )}
          </Field>

          <Field data-invalid={!!errors.ai_model}>
            <FieldLabel htmlFor="ai-model-input">模型名称 (Model)</FieldLabel>
            <Input
              id="ai-model-input"
              {...register("ai_model")}
              aria-invalid={!!errors.ai_model}
              placeholder="例如: deepseek-chat"
            />
            {errors.ai_model && (
              <FieldError>{errors.ai_model.message}</FieldError>
            )}
          </Field>
        </div>
      </FieldGroup>

      <div className="pt-2 flex justify-between gap-3 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onTestConnection}
          disabled={testingAi}
        >
          {testingAi ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Bot data-icon="inline-start" />
          )}
          {testingAi ? "正在测试连接..." : "测试模型连接"}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button type="button" variant="default" size="sm" onClick={onSave}>
            保存配置
          </Button>
        </div>
      </div>
    </div>
  );
}
