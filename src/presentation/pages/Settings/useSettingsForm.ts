import { useState } from "react";
import { toast } from "sonner";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig, Settings } from "@/domain/settings/SettingsSchemas";

interface FormSnapshot {
  downloadDir: string;
  proxy: string;
  maxDownloadSpeed: number;
  maxUploadSpeed: number;
  aiConfigs: AiConfig[];
}

export function useSettingsForm() {
  const [downloadDir, setDownloadDir] = useState("");
  const [proxy, setProxy] = useState("");
  const [maxDownloadSpeed, setMaxDownloadSpeed] = useState(0);
  const [maxUploadSpeed, setMaxUploadSpeed] = useState(0);

  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // null: not editing, -1: adding, >=0: editing index
  const [aliasInput, setAliasInput] = useState("");
  const [apiEndpointInput, setApiEndpointInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("");

  const [savedSnapshot, setSavedSnapshot] = useState<FormSnapshot | null>(null);

  const applySettings = (settings: Settings) => {
    setDownloadDir(settings.download_dir);
    setProxy(settings.proxy || "");
    setMaxDownloadSpeed(settings.max_download_speed ?? 0);
    setMaxUploadSpeed(settings.max_upload_speed ?? 0);
    setAiConfigs(settings.ai_configs || []);
    setSavedSnapshot({
      downloadDir: settings.download_dir,
      proxy: settings.proxy || "",
      maxDownloadSpeed: settings.max_download_speed ?? 0,
      maxUploadSpeed: settings.max_upload_speed ?? 0,
      aiConfigs: settings.ai_configs || [],
    });
  };

  const buildSnapshot = (): FormSnapshot => ({
    downloadDir,
    proxy,
    maxDownloadSpeed,
    maxUploadSpeed,
    aiConfigs: aiConfigs,
  });

  const isDirty =
    savedSnapshot !== null &&
    JSON.stringify(buildSnapshot()) !== JSON.stringify(savedSnapshot);

  const markSaved = () => setSavedSnapshot(buildSnapshot());

  const handleStartAdd = () => {
    setEditingIndex(-1);
    setAliasInput("");
    setApiEndpointInput("");
    setApiKeyInput("");
    setModelInput("");
  };

  const handleStartEdit = (index: number) => {
    const config = aiConfigs[index];
    /* v8 ignore next */
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
    setAiConfigs((prev) => prev.filter((_, i) => i !== index));
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

    if (editingIndex === -1) {
      setAiConfigs((prev) => [...prev, newConfig]);
    } else {
      setAiConfigs((prev) => {
        const next = [...prev];
        next[editingIndex as number] = newConfig;
        return next;
      });
    }
    setEditingIndex(null);
  };

  return {
    storage: {
      downloadDir,
      setDownloadDir,
      proxy,
      setProxy,
      maxDownloadSpeed,
      setMaxDownloadSpeed,
      maxUploadSpeed,
      setMaxUploadSpeed,
    },
    ai: {
      aiConfigs,
      editingIndex,
      aliasInput,
      setAliasInput,
      apiEndpointInput,
      setApiEndpointInput,
      apiKeyInput,
      setApiKeyInput,
      modelInput,
      setModelInput,
      handleStartAdd,
      handleStartEdit,
      handleCancelEdit,
      handleDeleteConfig,
      handleSaveConfig,
    },
    applySettings,
    markSaved,
    isDirty,
  };
}
