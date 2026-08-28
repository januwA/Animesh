import { Languages } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import type {
  AiConfig,
  TranslationProvider,
} from "@/domain/settings/SettingsSchemas";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Field, FieldLabel } from "@/presentation/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/presentation/components/ui/native-select";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";

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

export default function TranslationPage() {
  const {
    getTranslationConfigUseCase,
    setTranslationConfigUseCase,
    getAiConfigsUseCase,
  } = useDI();

  const [targetLang, setTargetLang] = useState("zh-CN");
  const [provider, setProvider] = useState<TranslationProvider>("google");
  const [aiConfigAlias, setAiConfigAlias] = useState<string | null>(null);

  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([]);

  const { loading } = useQuery(
    async () => {
      const [config, aiResult] = await Promise.all([
        getTranslationConfigUseCase.execute(),
        getAiConfigsUseCase.execute(),
      ]);
      return { config, aiResult };
    },
    [getTranslationConfigUseCase, getAiConfigsUseCase],
    {
      onSuccess: ({ config, aiResult }) => {
        setTargetLang(config.target_lang);
        setProvider(config.provider);
        setAiConfigAlias(config.ai_config_alias);
        setAiConfigs(aiResult.aiConfigs);
      },
    },
  );

  const { execute: save, loading: saving } = useMutation(
    () =>
      setTranslationConfigUseCase.execute({
        target_lang: targetLang,
        provider,
        ai_config_alias: aiConfigAlias,
      }),
    {
      onSuccess: () => {
        toast.success("翻译设置已保存");
      },
      onError: (err) => toast.error(`保存失败: ${err.message}`),
    },
  );

  if (loading) {
    return (
      <Card className="ani-card">
        <CardContent className="p-6 text-muted-foreground">
          加载中...
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Card className="ani-card">
        <CardHeader className="p-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Languages className="h-4 w-4 text-primary" />
            翻译设置
          </CardTitle>
          <CardAction>
            <Button type="submit" disabled={saving}>
              保存
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-5 pb-6 text-xs">
          <Field orientation="horizontal">
            <FieldLabel>目标语言</FieldLabel>
            <NativeSelect
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <NativeSelectOption key={opt.value} value={opt.value}>
                  {opt.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>翻译提供者</FieldLabel>
            <NativeSelect
              value={provider}
              onChange={(e) =>
                setProvider(e.target.value as TranslationProvider)
              }
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <NativeSelectOption key={opt.value} value={opt.value}>
                  {opt.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          {provider === "ai" && (
            <Field orientation="horizontal">
              <FieldLabel>AI 配置</FieldLabel>
              {/* v8 ignore start */}
              <NativeSelect
                value={aiConfigAlias ?? ""}
                onChange={(e) =>
                  setAiConfigAlias(
                    e.target.value === "" ? null : e.target.value,
                  )
                }
              >
                {/* v8 ignore stop */}
                <NativeSelectOption value="">请选择</NativeSelectOption>
                {aiConfigs?.map((config) => (
                  <NativeSelectOption key={config.alias} value={config.alias}>
                    {config.alias}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
