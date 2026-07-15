import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import {
	type AiConfig,
	type Settings,
	SettingsSchema,
} from "../../domain/settings/SettingsSchemas";
import { parseTrackers } from "../../domain/settings/TrackerSettings";
import { HttpClient } from "../http/HttpClient";

const baseUrl = import.meta.env.PROD
	? "/api"
	: (import.meta.env.VITE_API_BASE_URL as string) || "/api";

export class HttpSettingsRepository implements SettingsRepository {
	private readonly httpClient: HttpClient;

	constructor() {
		this.httpClient = new HttpClient();
	}

	async getSettings(): Promise<Settings> {
		const rawSettings = await this.httpClient.getJson<unknown>(
			`${baseUrl}/settings`,
		);

		const result = SettingsSchema.safeParse(rawSettings);
		if (!result.success) {
			throw new Error("Settings backend structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async getDefaultTrackers(): Promise<string[]> {
		return this.httpClient.getJson<string[]>(
			`${baseUrl}/settings/default-trackers`,
		);
	}

	async setDownloadDir(dir: string): Promise<void> {
		await this.httpClient.request(`${baseUrl}/settings/download-dir`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ dir }),
		});
	}

	async setProxy(proxy: string | null): Promise<void> {
		await this.httpClient.request(`${baseUrl}/settings/proxy`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ proxy }),
		});
	}

	async setTrackers(trackers: string[]): Promise<void> {
		await this.httpClient.request(`${baseUrl}/settings/trackers`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ trackers }),
		});
	}

	async setTrackerOptions(options: {
		sourceType: string | null;
		cdn: string | null;
		customUrl: string | null;
		autoUpdate: boolean | null;
		lastUpdateTime: number | null;
	}): Promise<void> {
		await this.httpClient.request(`${baseUrl}/settings/tracker-options`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				source_type: options.sourceType,
				cdn: options.cdn,
				custom_url: options.customUrl,
				auto_update: options.autoUpdate,
				last_update_time: options.lastUpdateTime,
			}),
		});
	}

	async setAiConfigs(configs: AiConfig[] | null): Promise<void> {
		await this.httpClient.request(`${baseUrl}/settings/ai-configs`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ configs }),
		});
	}

	async fetchTrackers(url: string): Promise<string[]> {
		if (!url) {
			throw new Error("Tracker URL 不能为空");
		}
		const response = await fetch(url).catch((err) => {
			throw new Error("获取 Tracker 列表网络连接失败", { cause: err });
		});
		if (!response.ok) {
			throw new Error(
				`获取 Tracker 列表失败: HTTP ${response.status} ${response.statusText}`,
			);
		}
		const text = await response.text();
		return parseTrackers(text);
	}

	async selectDirectory(): Promise<string | null> {
		// Web version doesn't support directory selection dialog
		return null;
	}

	async setTheme(_theme: string): Promise<void> {
		// Web version doesn't support native window theme sync
	}
}
