import { Languages } from "lucide-react";
import type {
  AiConfig,
  TranslationProvider,
} from "@/domain/settings/SettingsSchemas";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/presentation/components/ui/native-select";

export interface TranslationSettingsSectionProps {
  targetLang: string;
  provider: TranslationProvider;
  aiConfigAlias: string | null;
  aiConfigs: AiConfig[] | null;
  onTargetLangChange: (lang: string) => void;
  onProviderChange: (provider: TranslationProvider) => void;
  onAiConfigAliasChange: (alias: string | null) => void;
}

const LANGUAGE_OPTIONS = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁体中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
];

const PROVIDER_OPTIONS = [
  { value: "google", label: "Google Translate (免费)" },
  { value: "ai", label: "AI 大模型" },
];

export function TranslationSettingsSection({
  targetLang,
  provider,
  aiConfigAlias,
  aiConfigs,
  onTargetLangChange,
  onProviderChange,
  onAiConfigAliasChange,
}: TranslationSettingsSectionProps) {
  return (
    <Card className="ani-card">
      <CardHeader className="p-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Languages className="h-4 w-4 text-primary" />
          翻译设置
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground font-medium">目标语言</span>
          <NativeSelect
            value={targetLang}
            onChange={(e) => onTargetLangChange(e.target.value)}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <NativeSelectOption key={opt.value} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground font-medium">翻译提供者</span>
          <NativeSelect
            value={provider}
            onChange={(e) =>
              onProviderChange(e.target.value as TranslationProvider)
            }
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <NativeSelectOption key={opt.value} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        {provider === "ai" && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground font-medium">AI 配置</span>
            <NativeSelect
              value={aiConfigAlias ?? ""}
              onChange={(e) =>
                onAiConfigAliasChange(
                  e.target.value === "" ? null : e.target.value,
                )
              }
            >
              <NativeSelectOption value="">请选择</NativeSelectOption>
              {aiConfigs?.map((config) => (
                <NativeSelectOption key={config.alias} value={config.alias}>
                  {config.alias}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
