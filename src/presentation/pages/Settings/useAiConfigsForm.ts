import { useState } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";

export function useAiConfigsForm() {
  const {
    getAiConfigsUseCase,
    setAiConfigsUseCase,
    verifyAiConnectionUseCase,
  } = useDI();

  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [aliasInput, setAliasInput] = useState("");
  const [apiEndpointInput, setApiEndpointInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("");

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
    setAliasInput("");
    setApiEndpointInput("");
    setApiKeyInput("");
    setModelInput("");
  };

  const handleStartEdit = (index: number) => {
    const config = aiConfigs[index];
    if (!config) return;
    setEditingIndex(index);
    setAliasInput(config.alias);
    setApiEndpointInput(config.api_endpoint);
    setApiKeyInput(config.api_key);
    setModelInput(config.ai_model);
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

  const handleSaveConfig = () => {
    const alias = aliasInput.trim();
    const api_endpoint = apiEndpointInput.trim();
    const api_key = apiKeyInput.trim();
    const ai_model = modelInput.trim();

    if (!alias) {
      toast.warning("请输入别名");
      return;
    }
    if (!api_endpoint) {
      toast.warning("请输入接口地址");
      return;
    }
    if (!api_key) {
      toast.warning("请输入 API 密钥");
      return;
    }

    const duplicate = aiConfigs.some(
      (c, i) =>
        c.alias.toLowerCase() === alias.toLowerCase() && i !== editingIndex,
    );
    if (duplicate) {
      toast.warning("该别名已存在，请使用其他别名");
      return;
    }

    const newConfig: AiConfig = {
      alias: NonEmptyStringSchema.parse(alias),
      api_endpoint: NonEmptyStringSchema.parse(api_endpoint),
      api_key: NonEmptyStringSchema.parse(api_key),
      ai_model: NonEmptyStringSchema.parse(ai_model),
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
  };

  const handleTestConfig = (config: AiConfig) => {
    testConfig(config);
  };

  const handleTestCurrentConnection = () => {
    if (!apiEndpointInput.trim()) {
      toast.warning("请输入 AI 接口地址");
      return;
    }
    if (!apiKeyInput.trim()) {
      toast.warning("请输入 API 密钥");
      return;
    }
    testConfig({
      alias: NonEmptyStringSchema.parse(aliasInput),
      api_endpoint: NonEmptyStringSchema.parse(apiEndpointInput),
      api_key: NonEmptyStringSchema.parse(apiKeyInput),
      ai_model: NonEmptyStringSchema.parse(modelInput),
    });
  };

  return {
    aiConfigs,
    editingIndex,
    aliasInput,
    apiEndpointInput,
    apiKeyInput,
    modelInput,
    testingAi,
    saving,
    loading,
    setAliasInput,
    setApiEndpointInput,
    setApiKeyInput,
    setModelInput,
    handleStartAdd,
    handleStartEdit,
    handleCancelEdit,
    handleDeleteConfig,
    handleSaveConfig,
    handleTestConfig,
    handleTestCurrentConnection,
  };
}
