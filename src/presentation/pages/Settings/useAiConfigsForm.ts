import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import {
  type AiConfig,
  type AiConfigInput,
  AiConfigSchema,
} from "@/domain/settings/SettingsSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";

export function useAiConfigsForm() {
  const {
    getAiConfigsUseCase,
    setAiConfigsUseCase,
    verifyAiConnectionUseCase,
  } = useDI();

  const form = useForm<AiConfigInput>({
    resolver: zodResolver(AiConfigSchema),
    defaultValues: { alias: "", api_endpoint: "", api_key: "", ai_model: "" },
  });

  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { loading } = useQuery(
    () => getAiConfigsUseCase.execute(),
    [getAiConfigsUseCase],
    {
      onSuccess: (result) => {
        setAiConfigs(result.aiConfigs);
      },
    },
  );

  const { execute: saveConfigs, loading: saving } = useMutation(
    (_ctx, configs: AiConfig[]) => setAiConfigsUseCase.execute(configs),
    {
      onSuccess: () => toast.success("AI 配置已保存"),
      onError: (err) => toast.error(`保存失败: ${err.message}`),
    },
  );

  const { execute: testConfig, loading: testingAi } = useMutation(
    (_ctx, config: AiConfig) => verifyAiConnectionUseCase.execute(config),
    {
      onSuccess: () => toast.success("AI 模型连接测试成功！"),
      onError: (err) =>
        toast.error(`AI 模型连接测试失败: ${err.message}`, {
          duration: 5000,
        }),
    },
  );

  const handleStartAdd = () => {
    setEditingIndex(-1);
    form.reset({ alias: "", api_endpoint: "", api_key: "", ai_model: "" });
  };

  const handleStartEdit = (index: number) => {
    const config = aiConfigs[index];
    /* v8 ignore next */
    if (!config) return;
    setEditingIndex(index);
    form.reset({
      alias: config.alias,
      api_endpoint: config.api_endpoint,
      api_key: config.api_key,
      ai_model: config.ai_model,
    });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleDeleteConfig = (index: number) => {
    const next = aiConfigs.filter((_, i) => i !== index);
    setAiConfigs(next);
    saveConfigs(next);
    if (editingIndex === index) {
      setEditingIndex(null);
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const handleSaveConfig = form.handleSubmit((data) => {
    const alias = data.alias.trim();

    const duplicate = aiConfigs.some(
      (c, i) =>
        c.alias.toLowerCase() === alias.toLowerCase() && i !== editingIndex,
    );
    if (duplicate) {
      form.setError("alias", { message: "该别名已存在，请使用其他别名" });
      return;
    }

    const newConfig: AiConfig = {
      alias: NonEmptyStringSchema.parse(data.alias),
      api_endpoint: NonEmptyStringSchema.parse(data.api_endpoint),
      api_key: NonEmptyStringSchema.parse(data.api_key),
      ai_model: NonEmptyStringSchema.parse(data.ai_model),
    };

    let next: AiConfig[];
    if (editingIndex === -1) {
      next = [...aiConfigs, newConfig];
    } else {
      next = [...aiConfigs];
      next[editingIndex as number] = newConfig;
    }
    setAiConfigs(next);
    setEditingIndex(null);
    saveConfigs(next);
  });

  const handleTestConfig = (config: AiConfig) => {
    testConfig(config);
  };

  const handleTestCurrentConnection = async () => {
    const valid = await form.trigger(["api_endpoint", "api_key"]);
    if (!valid) return;
    const values = form.getValues();
    testConfig({
      alias: NonEmptyStringSchema.parse(values.alias),
      api_endpoint: NonEmptyStringSchema.parse(values.api_endpoint),
      api_key: NonEmptyStringSchema.parse(values.api_key),
      ai_model: NonEmptyStringSchema.parse(values.ai_model),
    });
  };

  return {
    form,
    aiConfigs,
    editingIndex,
    testingAi,
    saving,
    loading,
    handleStartAdd,
    handleStartEdit,
    handleCancelEdit,
    handleDeleteConfig,
    handleSaveConfig,
    handleTestConfig,
    handleTestCurrentConnection,
  };
}
