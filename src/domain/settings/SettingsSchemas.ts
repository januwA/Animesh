import { z } from "zod";

export const AiConfigSchema = z.object({
  alias: z.string().trim().min(1, "别名不能为空"),
  api_endpoint: z.string().trim().min(1, "接口地址不能为空"),
  api_key: z.string().trim().min(1, "API 密钥不能为空"),
  ai_model: z.string().trim().min(1, "AI 模型不能为空"),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

export const SettingsSchema = z.object({
  download_dir: z.string(),
  proxy: z.string().nullable().optional(),
  ai_configs: z.array(AiConfigSchema).nullable().optional(),
  max_download_speed: z.number().nullable().optional(),
  max_upload_speed: z.number().nullable().optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;

// UI settings form validation schema
export const SettingsFormSchema = z.object({
  downloadDir: z.string().trim().min(1, "下载目录不能为空"),
  proxy: z
    .string()
    .trim()
    .refine(
      (val) => {
        if (!val) return true;
        // 支持 http://, https://, socks5:// 开头的代理，或者 host:port 格式
        const hasProtocol = /^(https?|socks5h?):\/\//i.test(val);
        if (hasProtocol) {
          try {
            new URL(val);
            return true;
          } catch {
            return false;
          }
        }
        // 检查是否是 host:port 格式
        return /^[a-zA-Z0-9.-]+:\d+$/.test(val);
      },
      {
        message: "代理格式不正确，支持 http/https/socks5 协议或 host:port 格式",
      },
    )
    .nullable()
    .or(z.literal("")),
  aiConfigs: z.array(AiConfigSchema).nullable().optional(),
  maxDownloadSpeed: z
    .number()
    .int("下载速度限制必须是整数")
    .min(0, "下载速度限制不能为负数")
    .nullable()
    .optional(),
  maxUploadSpeed: z
    .number()
    .int("上传速度限制必须是整数")
    .min(0, "上传速度限制不能为负数")
    .nullable()
    .optional(),
});

export type SettingsFormInput = z.infer<typeof SettingsFormSchema>;
