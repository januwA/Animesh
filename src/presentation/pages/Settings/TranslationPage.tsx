import { useState } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import type {
  AiConfig,
  TranslationProvider,
} from "@/domain/settings/SettingsSchemas";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/presentation/components/ui/field";
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
      <FieldGroup>
        <FieldSet>
          <FieldLegend>翻译设置</FieldLegend>
          <FieldDescription>
            设置翻译的目标语言和翻译服务提供者
          </FieldDescription>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="target-lang">目标语言</FieldLabel>
              <NativeSelect
                id="target-lang"
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

            <Field>
              <FieldLabel htmlFor="translation-provider">翻译提供者</FieldLabel>
              <NativeSelect
                id="translation-provider"
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
              <Field>
                <FieldLabel htmlFor="ai-config">AI 配置</FieldLabel>
                <NativeSelect
                  id="ai-config"
                  value={aiConfigAlias ?? ""}
                  onChange={(e) =>
                    setAiConfigAlias(
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
              </Field>
            )}
          </FieldGroup>
        </FieldSet>

        <Field orientation="horizontal">
          <Button type="submit" disabled={saving}>
            保存
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
