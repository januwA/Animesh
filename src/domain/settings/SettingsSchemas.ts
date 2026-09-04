import { z } from "zod";
import { NonEmptyStringSchema } from "../common/NonEmptyString";

export const AiConfigSchema = z.object({
  alias: NonEmptyStringSchema.min(1, "别名不能为空"),
  api_endpoint: NonEmptyStringSchema.min(1, "接口地址不能为空"),
  api_key: NonEmptyStringSchema.min(1, "API 密钥不能为空"),
  ai_model: NonEmptyStringSchema.min(1, "AI 模型不能为空"),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

export type AiConfigInput = {
  alias: string;
  api_endpoint: string;
  api_key: string;
  ai_model: string;
};

export const TranslationProviderSchema = z.enum(["google", "ai"]);
export type TranslationProvider = z.infer<typeof TranslationProviderSchema>;

export const TranslationConfigSchema = z.object({
  target_lang: z.string().default("zh-CN"),
  provider: TranslationProviderSchema.default("google"),
  ai_config_alias: z.string().nullable().default(null),
});
export type TranslationConfig = z.infer<typeof TranslationConfigSchema>;

export const StorageFormSchema = z.object({
  downloadDir: z.string().min(1, "下载目录不能为空"),
  maxDownloadSpeed: z.number().min(0, "速度不能为负数"),
  maxUploadSpeed: z.number().min(0, "速度不能为负数"),
});
export type StorageForm = z.infer<typeof StorageFormSchema>;

export const SettingsSchema = z.object({
  download_dir: z.string(),
  proxy: z.string().nullable(),
  ai_configs: z.array(AiConfigSchema).nullable(),
  max_download_speed: z.number().nullable(),
  max_upload_speed: z.number().nullable(),
  translation: TranslationConfigSchema.catch({
    target_lang: "zh-CN",
    provider: "google",
    ai_config_alias: null,
  }),
});

export type Settings = z.infer<typeof SettingsSchema>;
