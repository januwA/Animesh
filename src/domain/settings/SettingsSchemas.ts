import { z } from "zod";

export const SettingsSchema = z.object({
	download_dir: z.string(),
	proxy: z.string().nullable().optional(),
	trackers: z.array(z.string()).optional(),
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
});

export type SettingsFormInput = z.infer<typeof SettingsFormSchema>;
