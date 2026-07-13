import { z } from "zod";

export const AiConfigSchema = z.object({
	alias: z.string(),
	api_endpoint: z.string(),
	api_key: z.string(),
	ai_model: z.string().nullable().optional(),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

export const SettingsSchema = z.object({
	download_dir: z.string(),
	proxy: z.string().nullable().optional(),
	trackers: z.array(z.string()).optional(),
	tracker_source_type: z.string().nullable().optional(),
	tracker_cdn: z.string().nullable().optional(),
	tracker_custom_url: z.string().nullable().optional(),
	tracker_auto_update: z.boolean().nullable().optional(),
	tracker_last_update_time: z.number().nullable().optional(),
	ai_configs: z.array(AiConfigSchema).nullable().optional(),
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
	trackers: z.array(z.string().trim().url("Tracker 地址必须是合法的 URL")),
	trackerSourceType: z.string().nullable().optional(),
	trackerCdn: z.string().nullable().optional(),
	trackerCustomUrl: z.string().nullable().optional(),
	trackerAutoUpdate: z.boolean().nullable().optional(),
	trackerLastUpdateTime: z.number().nullable().optional(),
	aiConfigs: z
		.array(
			z.object({
				alias: z.string().trim().min(1, "别名不能为空"),
				apiEndpoint: z.string().trim().min(1, "接口地址不能为空"),
				apiKey: z.string().trim().min(1, "API 密钥不能为空"),
				model: z.string().trim().nullable().optional(),
			}),
		)
		.nullable()
		.optional(),
});

export type SettingsFormInput = z.infer<typeof SettingsFormSchema>;
