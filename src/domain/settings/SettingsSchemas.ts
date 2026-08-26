import { z } from "zod";
import { NonEmptyStringSchema } from "../common/NonEmptyString";

export const AiConfigSchema = z.object({
  alias: NonEmptyStringSchema.min(1, "别名不能为空"),
  api_endpoint: NonEmptyStringSchema.min(1, "接口地址不能为空"),
  api_key: NonEmptyStringSchema.min(1, "API 密钥不能为空"),
  ai_model: NonEmptyStringSchema.min(1, "AI 模型不能为空"),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

export const SettingsSchema = z.object({
  download_dir: z.string(),
  proxy: z.string().nullable(),
  ai_configs: z.array(AiConfigSchema).nullable(),
  max_download_speed: z.number().nullable(),
  max_upload_speed: z.number().nullable(),
});

export type Settings = z.infer<typeof SettingsSchema>;
