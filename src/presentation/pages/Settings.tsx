import {
  Bot,
  Check,
  Download,
  Folder,
  Gauge,
  Globe,
  HardDrive,
  Info,
  Lightbulb,
  Link2,
  Loader2,
  Palette,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useBlocker } from "react-router-dom";
import { toast } from "sonner";
import type { SaveSettingsDto } from "@/application/settings/SaveSettingsUseCase";
import { useDI } from "@/di/DIContext";
import { SettingsFormSchema } from "@/domain/settings/SettingsSchemas";
import {
  getTrackerUrl,
  type TrackerSourceType,
} from "@/domain/settings/TrackerSettings";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Checkbox } from "@/presentation/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Input } from "@/presentation/components/ui/input";
import { Textarea } from "@/presentation/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/presentation/components/ui/toggle-group";
import {
  ACCENT_PRESETS,
  useAccentTheme,
} from "@/presentation/hooks/useAccentTheme";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";
import { cn } from "@/presentation/lib/utils";
import { formatError, formatLocalDate } from "@/utils";

interface AiConfigDraft {
  alias: string;
  apiEndpoint: string;
  apiKey: string;
  model?: string | null;
}

interface FormSnapshot {
  downloadDir: string;
  proxy: string;
  trackers: string[];
  sourceType: TrackerSourceType;
  customUrl: string;
  autoUpdate: boolean;
  lastUpdateTime: number;
  maxDownloadSpeed: number;
  aiConfigs: AiConfigDraft[];
}

function parseTrackersText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function toAiConfigDrafts(configs: AiConfigDraft[]): AiConfigDraft[] {
  return configs.map((c) => ({
    alias: c.alias,
    apiEndpoint: c.apiEndpoint,
    apiKey: c.apiKey,
    model: c.model ?? null,
  }));
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccentTheme();
  const {
    getSettingsUseCase,
    getDefaultTrackersUseCase,
    saveSettingsUseCase,
    selectDirectoryUseCase,
    syncTrackersUseCase,
    checkUpdateUseCase,
    getCurrentVersionUseCase,
    openUpdateUrlUseCase,
    verifyAiConnectionUseCase,
  } = useDI();
  const isTauri = import.meta.env.MODE !== "web";

  const isMobile =
    ["android", "ios"].includes(import.meta.env.TAURI_ENV_PLATFORM || "") ||
    (typeof navigator !== "undefined" &&
      /android|iphone|ipad|ipod/i.test(navigator.userAgent));

  const [downloadDir, setDownloadDir] = useState("");
  const [proxy, setProxy] = useState("");
  const [trackersText, setTrackersText] = useState("");
  const [sourceType, setSourceType] = useState<TrackerSourceType>("best");
  const [customUrl, setCustomUrl] = useState("");
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [maxDownloadSpeed, setMaxDownloadSpeed] = useState(0);

  const [aiConfigs, setAiConfigs] = useState<
    {
      alias: string;
      apiEndpoint: string;
      apiKey: string;
      model?: string | null;
    }[]
  >([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // null: not editing, -1: adding, >=0: editing index
  const [aliasInput, setAliasInput] = useState("");
  const [apiEndpointInput, setApiEndpointInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("");

  const [savedSnapshot, setSavedSnapshot] = useState<FormSnapshot | null>(null);

  // Load settings
  const settingsQuery = useQuery(
    () => getSettingsUseCase.execute(),
    [getSettingsUseCase],
    {
      onSuccess: (settings) => {
        setDownloadDir(settings.download_dir);
        setProxy(settings.proxy || "");
        setTrackersText((settings.trackers || []).join("\n"));
        setSourceType(
          (settings.tracker_source_type || "best") as TrackerSourceType,
        );
        setCustomUrl(settings.tracker_custom_url || "");
        setAutoUpdate(settings.tracker_auto_update === true);
        setLastUpdateTime(settings.tracker_last_update_time || 0);
        setMaxDownloadSpeed(settings.max_download_speed ?? 0);

        const loadedConfigs = (settings.ai_configs || []).map((c) => ({
          alias: c.alias,
          apiEndpoint: c.api_endpoint,
          apiKey: c.api_key,
          model: c.ai_model,
        }));
        setAiConfigs(loadedConfigs);
        setSavedSnapshot({
          downloadDir: settings.download_dir,
          proxy: settings.proxy || "",
          trackers: parseTrackersText((settings.trackers || []).join("\n")),
          sourceType: (settings.tracker_source_type ||
            "best") as TrackerSourceType,
          customUrl: settings.tracker_custom_url || "",
          autoUpdate: settings.tracker_auto_update === true,
          lastUpdateTime: settings.tracker_last_update_time || 0,
          maxDownloadSpeed: settings.max_download_speed ?? 0,
          aiConfigs: toAiConfigDrafts(loadedConfigs),
        });
      },
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

  // AI connection test
  const verifyAiMutation = useMutation(
    (
      _ctx,
      config: { apiEndpoint: string; apiKey: string; model?: string | null },
    ) =>
      verifyAiConnectionUseCase.execute({
        apiEndpoint: config.apiEndpoint,
        apiKey: config.apiKey,
        model: config.model || undefined,
      }),
    {
      onSuccess: () => toast.success("AI 模型连接测试成功！"),
      onError: (err) =>
        toast.error(`AI 模型连接测试失败: ${formatError(err)}`, {
          duration: 5000,
        }),
    },
  );
  const testingAi = verifyAiMutation.loading;

  const handleTestConfigConnection = (config: {
    apiEndpoint: string;
    apiKey: string;
    model?: string | null;
  }) => {
    verifyAiMutation.execute({
      apiEndpoint: config.apiEndpoint,
      apiKey: config.apiKey,
      model: config.model || undefined,
    });
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
    handleTestConfigConnection({
      apiEndpoint: apiEndpointInput,
      apiKey: apiKeyInput,
      model: modelInput,
    });
  };

  const currentUrl = getTrackerUrl(sourceType, customUrl);

  // Tracker sync
  const syncMutation = useMutation(
    (_ctx, params: { url: string; mode: "replace" | "append" }) =>
      syncTrackersUseCase.execute(params.url),
    {
      onSuccess: (fetched, params) => {
        if (fetched.length === 0) {
          toast.warning("未获取到有效的 Tracker 地址");
          return;
        }

        if (params.mode === "replace") {
          setTrackersText(fetched.join("\n"));
          toast.success(
            `同步成功：已替换为最新的 ${fetched.length} 个 Tracker，请保存设置`,
          );
        } else {
          const currentTrackers = trackersText
            .split("\n")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
          const merged = Array.from(new Set([...currentTrackers, ...fetched]));
          setTrackersText(merged.join("\n"));
          const addedCount = merged.length - currentTrackers.length;
          toast.success(
            `同步成功：已追加 ${addedCount} 个新 Tracker (共计 ${merged.length} 个)，请保存设置`,
          );
        }

        setLastUpdateTime(Date.now());
      },
      onError: (err) => toast.error(`同步 Tracker 失败: ${formatError(err)}`),
    },
  );
  const syncing = syncMutation.loading;

  const handleSync = (mode: "replace" | "append") => {
    if (sourceType === "custom" && !customUrl) {
      toast.warning("请输入自定义 Tracker 列表 URL");
      return;
    }

    syncMutation.execute({ url: getTrackerUrl(sourceType, customUrl), mode });
  };

  // Check update
  const checkUpdateMutation = useMutation(() => checkUpdateUseCase.execute(), {
    onSuccess: (result) => {
      if (result.hasUpdate) {
        toast(`发现新版本 v${result.latestVersion}`);
      } else {
        toast.success("当前已是最新版本");
      }
    },
    onError: (err) => toast.error(`检查更新失败: ${formatError(err)}`),
  });
  const checkingUpdate = checkUpdateMutation.loading;
  const updateResult = checkUpdateMutation.data;
  const handleCheckUpdate = () => {
    checkUpdateMutation.execute();
  };

  // Directory selection
  const selectDirMutation = useMutation(
    () => selectDirectoryUseCase.execute(),
    {
      onSuccess: (selected) => {
        if (selected) {
          setDownloadDir(selected);
          toast.success("已选择目录，点击保存以生效");
        }
      },
      onError: (err) => toast.error(`选择文件夹失败: ${formatError(err)}`),
    },
  );
  const handleSelectDir = () => {
    selectDirMutation.execute();
  };

  // Reset to default trackers
  const resetTrackersMutation = useMutation(
    () => getDefaultTrackersUseCase.execute(),
    {
      onSuccess: (defaults) => {
        setTrackersText(defaults.join("\n"));
        toast.success("已重置为默认 Tracker 列表，点击保存生效");
      },
      onError: (err) =>
        toast.error(`获取默认 Tracker 列表失败: ${formatError(err)}`),
    },
  );

  // Save settings
  const saveMutation = useMutation(
    (_ctx, data: SaveSettingsDto) => saveSettingsUseCase.execute(data),
    {
      onSuccess: () => {
        toast.success("设置已保存，后续下载任务将使用新路径");
        setSavedSnapshot({
          downloadDir,
          proxy,
          trackers: parseTrackersText(trackersText),
          sourceType,
          customUrl,
          autoUpdate,
          lastUpdateTime,
          maxDownloadSpeed,
          aiConfigs: toAiConfigDrafts(aiConfigs),
        });
      },
      onError: (err) =>
        toast.error(`保存路径失败: ${formatError(err)}`, { duration: 5000 }),
    },
  );
  const saving = saveMutation.loading;

  const handleSave = (e: React.SubmitEvent) => {
    e.preventDefault();

    const parsedTrackers = trackersText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const validation = SettingsFormSchema.safeParse({
      downloadDir,
      proxy,
      trackers: parsedTrackers,
      trackerSourceType: sourceType,
      trackerCustomUrl: customUrl,
      trackerAutoUpdate: autoUpdate,
      trackerLastUpdateTime: lastUpdateTime,
      aiConfigs,
      maxDownloadSpeed: maxDownloadSpeed || null,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0].message;
      toast.error(firstError);
      return;
    }

    saveMutation.execute(validation.data);
  };

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
    setApiEndpointInput(config.apiEndpoint);
    setApiKeyInput(config.apiKey);
    setModelInput(config.model || "");
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
    const apiEndpoint = apiEndpointInput.trim();
    const apiKey = apiKeyInput.trim();
    const model = modelInput.trim() || null;

    if (!alias) {
      toast.warning("请输入别名");
      return;
    }
    if (!apiEndpoint) {
      toast.warning("请输入接口地址");
      return;
    }
    if (!apiKey) {
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

    const newConfig = { alias, apiEndpoint, apiKey, model };

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

  const buildSnapshotFromState = (): FormSnapshot => ({
    downloadDir,
    proxy,
    trackers: parseTrackersText(trackersText),
    sourceType,
    customUrl,
    autoUpdate,
    lastUpdateTime,
    maxDownloadSpeed,
    aiConfigs: toAiConfigDrafts(aiConfigs),
  });

  const isDirty =
    savedSnapshot !== null &&
    JSON.stringify(buildSnapshotFromState()) !== JSON.stringify(savedSnapshot);

  const blocker = useBlocker(isDirty);
  const confirmLeaveOpen = blocker.state === "blocked";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">
          正在加载设置面版...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Settings Form */}
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Sticky Action Header */}
        <div className="sticky-safe-top z-20 bg-background/85 backdrop-blur-md py-3 -mx-4 px-4 flex items-center justify-between border-b border-border shadow-sm">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">软件设置</span>
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="gap-1.5 text-xs font-semibold px-5 shadow-sm"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            保存设置
          </Button>
        </div>
        {isTauri && (
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="p-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <HardDrive className="h-4 w-4 text-primary" />
                存储设置 (BT 下载及缓存目录)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="download-dir-input"
                  className="text-muted-foreground font-medium"
                >
                  默认下载及播放缓存目录
                </label>
                <div className="flex gap-2">
                  <Input
                    id="download-dir-input"
                    value={downloadDir}
                    disabled={isMobile}
                    onChange={(e) => setDownloadDir(e.target.value)}
                    placeholder={
                      isMobile
                        ? "应用沙盒内部路径"
                        : "选择或输入下载路径，例如 D:\\AnimeshDownloads"
                    }
                    className="flex-1 bg-secondary/30 border-border text-foreground py-5 text-xs disabled:opacity-80"
                  />
                  {!isMobile && isTauri && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSelectDir}
                      className="gap-1.5 h-10.5 font-medium px-4 text-xs"
                    >
                      <Folder className="h-4 w-4" />
                      选择目录
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-1 flex flex-col gap-1.5">
                  {isMobile ? (
                    <span className="flex items-center gap-1">
                      <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                      移动端（Android/iOS）已自动选用应用沙盒内部路径，无需且不支持手动更改。
                    </span>
                  ) : (
                    <span className="flex items-start gap-1">
                      <Lightbulb className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                      <span>
                        提示：边下边播的缓存与下载的完整文件均保存在该路径下。建议选择剩余空间较大的磁盘分区（非系统C盘），以防空间不足导致播放异常。
                      </span>
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t border-border">
                <label
                  htmlFor="max-download-speed-input"
                  className="text-muted-foreground font-medium flex items-center gap-1.5"
                >
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  后台下载速度限制
                </label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="max-download-speed-input"
                    type="number"
                    min={0}
                    value={maxDownloadSpeed}
                    onChange={(e) =>
                      setMaxDownloadSpeed(Number(e.target.value))
                    }
                    placeholder="0"
                    className="sm:w-28"
                  />
                  <span className="text-xs text-muted-foreground font-medium">
                    KB/s
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-1 flex items-start gap-1">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    限制 BT
                    后台下载的速率，避免占用全部网络带宽影响日常使用。设为 0
                    表示不限速。
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isTauri && (
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="p-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Globe className="h-4 w-4 text-primary" />
                网络设置
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="proxy-input"
                  className="text-muted-foreground font-medium"
                >
                  代理服务器地址
                </label>
                <Input
                  id="proxy-input"
                  value={proxy}
                  onChange={(e) => setProxy(e.target.value)}
                  placeholder="例如 http://127.0.0.1:7890 或 socks5://127.0.0.1:7890 (留空则不使用代理)"
                  className="bg-secondary/30 border-border text-foreground py-5 text-xs"
                />
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-1 flex items-start gap-1">
                  <Lightbulb className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                  <span>
                    提示：部分地区可能有网络问题 搜索无结果，可配置代理。支持
                    HTTP、HTTPS 或 SOCKS5 代理。
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="p-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Bot className="h-4 w-4 text-primary" />
              AI 智能搜索模型设置
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
            {/* AI 配置列表 */}
            <div className="flex flex-col gap-3">
              {aiConfigs.map((config, index) => (
                <div
                  key={index.toString()}
                  className="flex items-center justify-between border border-border bg-secondary/30 rounded-lg p-3"
                >
                  <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
                    <div className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                      <span>{config.alias}</span>
                      {config.model && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                          {config.model}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate max-w-50 sm:max-w-xs md:max-w-md">
                      {config.apiEndpoint}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConfigConnection(config)}
                      disabled={testingAi}
                      className="h-7 px-2.5 text-[10px] font-medium border-border bg-secondary/50 text-foreground hover:bg-secondary"
                    >
                      测试
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleStartEdit(index)}
                      className="h-7 px-2.5 text-[10px] font-medium"
                    >
                      编辑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteConfig(index)}
                      className="h-7 px-2.5 text-[10px] font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}

              {aiConfigs.length === 0 && (
                <Empty className="py-6 border-dashed">
                  <EmptyContent>
                    <EmptyTitle>暂无 AI 配置</EmptyTitle>
                  </EmptyContent>
                </Empty>
              )}

              {editingIndex === null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStartAdd}
                  className="w-full h-8.5 font-medium border-border bg-secondary/50 text-foreground hover:bg-secondary text-xs flex items-center justify-center gap-1.5 mt-2"
                >
                  + 添加 AI 配置
                </Button>
              )}
            </div>

            {/* 编辑/添加表单 */}
            {editingIndex !== null && (
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
                      onChange={(e) => setAliasInput(e.target.value)}
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
                      onChange={(e) => setApiEndpointInput(e.target.value)}
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
                      onChange={(e) => setApiKeyInput(e.target.value)}
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
                      onChange={(e) => setModelInput(e.target.value)}
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
                    onClick={handleTestCurrentConnection}
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
                      onClick={handleCancelEdit}
                      className="h-8 text-xs font-medium"
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleSaveConfig}
                      className="h-8 text-xs font-medium bg-primary text-primary-foreground"
                    >
                      保存配置
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {isTauri && (
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="p-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Info className="h-4 w-4 text-primary" />
                检查更新
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-border bg-secondary/30 rounded-lg p-4">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-foreground">
                    Animesh 客户端
                  </p>
                  <p className="text-muted-foreground">
                    当前版本：{currentVersion || "加载中..."}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={checkingUpdate}
                    onClick={handleCheckUpdate}
                    className="text-xs h-8.5 font-medium border-border bg-secondary/50 text-foreground hover:bg-secondary"
                  >
                    {checkingUpdate ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    检查更新
                  </Button>
                </div>
              </div>

              {updateResult && (
                <div className="border border-border bg-secondary/30 rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground">
                      {updateResult.hasUpdate
                        ? "发现新版本！"
                        : "当前已是最新版本"}
                    </h4>
                    {updateResult.hasUpdate && (
                      <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">
                        v{updateResult.latestVersion}
                      </span>
                    )}
                  </div>

                  {updateResult.hasUpdate && (
                    <>
                      <p className="text-muted-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {updateResult.notes}
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          onClick={async () => {
                            if (updateResult.htmlUrl) {
                              try {
                                await openUpdateUrlUseCase.execute(
                                  updateResult.htmlUrl,
                                );
                              } catch (err: unknown) {
                                toast.error(
                                  `无法打开链接: ${formatError(err)}`,
                                );
                              }
                            }
                          }}
                          className="text-xs h-8 font-medium px-3 bg-primary text-primary-foreground"
                        >
                          前往 GitHub 下载
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="p-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Palette className="h-4 w-4 text-primary" />
              外观设置
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium">
                选择界面主题
              </span>
              <ToggleGroup
                type="single"
                value={theme}
                onValueChange={(v) => v && setTheme(v)}
                size="sm"
                variant="outline"
              >
                <ToggleGroupItem value="system">跟随系统</ToggleGroupItem>
                <ToggleGroupItem value="light">浅色模式</ToggleGroupItem>
                <ToggleGroupItem value="dark">深色模式</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium">
                选择主色调
              </span>
              <div className="flex items-center gap-2.5">
                {ACCENT_PRESETS.map((preset) => {
                  const selected = accent === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-label={preset.label}
                      aria-pressed={selected}
                      title={preset.label}
                      onClick={() => setAccent(preset.id)}
                      className={cn(
                        "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border transition-transform",
                        selected
                          ? "scale-110 ring-2 ring-ring ring-offset-2 ring-offset-background"
                          : "hover:scale-105",
                      )}
                      style={{ backgroundColor: preset.color }}
                    >
                      {selected && <Check className="h-4 w-4 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="p-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Link2 className="h-4 w-4 text-primary" />
              BT Trackers 设置 (加速磁力解析与下载)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
            {/* Tracker Online Sync & Enhancement Section */}
            <div className="border border-border bg-secondary/30 rounded-lg p-4 flex flex-col gap-4 mb-6">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  在线同步与自动更新 (ngosang/trackerslist)
                </h4>
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  每日自动同步
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left side: Configs */}
                <div className="flex flex-col gap-3.5">
                  {/* Source Type Selection */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      选择列表源
                    </span>
                    <ToggleGroup
                      type="single"
                      value={sourceType}
                      onValueChange={(v) =>
                        v && setSourceType(v as TrackerSourceType)
                      }
                      size="sm"
                      variant="outline"
                      className="flex-wrap"
                    >
                      <ToggleGroupItem value="best">
                        最优列表 (推荐)
                      </ToggleGroupItem>
                      <ToggleGroupItem value="all">完整列表</ToggleGroupItem>
                      <ToggleGroupItem value="best_ip">最优 IP</ToggleGroupItem>
                      <ToggleGroupItem value="all_ip">完整 IP</ToggleGroupItem>
                      <ToggleGroupItem value="custom">自定义</ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {/* Auto Update Checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="auto-update-checkbox"
                      checked={autoUpdate}
                      onCheckedChange={(checked) =>
                        setAutoUpdate(checked === true)
                      }
                    />
                    <label
                      htmlFor="auto-update-checkbox"
                      className="text-[11px] text-foreground font-medium cursor-pointer select-none"
                    >
                      启动时自动更新 (每24小时)
                    </label>
                  </div>
                </div>

                {/* Right side: Input URL & Sync actions */}
                <div className="flex flex-col justify-between gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="tracker-url-input"
                      className="text-[11px] text-muted-foreground font-medium"
                    >
                      {sourceType === "custom"
                        ? "自定义 URL 地址"
                        : "当前解析同步地址"}
                    </label>
                    <Input
                      id="tracker-url-input"
                      value={sourceType === "custom" ? customUrl : currentUrl}
                      onChange={(e) => {
                        setCustomUrl(e.target.value);
                      }}
                      disabled={sourceType !== "custom"}
                      placeholder="引导地址例如 https://example.com/trackers.txt"
                      className="bg-secondary/30 border-border text-foreground py-2 text-[11px] h-8"
                    />
                  </div>

                  {/* Sync actions */}
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={syncing}
                        onClick={() => handleSync("replace")}
                        className="flex-1 text-[11px] h-8.5 font-medium gap-1.5"
                      >
                        {syncing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        立即同步并替换
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={syncing}
                        onClick={() => handleSync("append")}
                        className="flex-1 text-[11px] h-8.5 font-medium gap-1.5 border-border bg-secondary/50 text-foreground hover:bg-secondary"
                      >
                        <Download className="h-3.5 w-3.5" />
                        追加同步
                      </Button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 px-0.5">
                      <span>最后更新时间：</span>
                      <span className="font-mono">
                        {lastUpdateTime
                          ? formatLocalDate(lastUpdateTime)
                          : "从未更新"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="trackers-input"
                  className="text-muted-foreground font-medium"
                >
                  Tracker 服务器列表 (每行一个)
                </label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => resetTrackersMutation.execute()}
                  className="text-[11px]"
                >
                  重置为默认值
                </Button>
              </div>
              <Textarea
                id="trackers-input"
                value={trackersText}
                onChange={(e) => setTrackersText(e.target.value)}
                placeholder="请输入 Tracker 地址，每行输入一个"
                rows={8}
                className="bg-secondary/30 text-xs"
              />
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-1 flex items-start gap-1">
                <Lightbulb className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span>
                  提示：添加高质量的公网 Tracker
                  可以极大地加快纯净磁力链接的解析速度，并帮助你更快地连接到
                  Peers。
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </form>

      <Dialog
        open={confirmLeaveOpen}
        onOpenChange={(open) => !open && blocker.reset?.()}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>放弃未保存的更改？</DialogTitle>
            <DialogDescription>
              当前页面存在未保存的设置，离开后这些修改将丢失。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => blocker.reset?.()}
            >
              取消
            </Button>
            <Button type="button" onClick={() => blocker.proceed?.()}>
              确认离开
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
