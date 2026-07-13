import { invoke } from "@tauri-apps/api/core";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import {
	type AiConfig,
	type Settings,
	SettingsSchema,
} from "../../domain/settings/SettingsSchemas";
import { parseTrackers } from "../../domain/settings/TrackerSettings";

export class TauriSettingsRepository implements SettingsRepository {
	async getSettings(): Promise<Settings> {
		const rawSettings = await invoke<unknown>("settings_get");
		const result = SettingsSchema.safeParse(rawSettings);
		if (!result.success) {
			throw new Error("Settings backend structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async setDownloadDir(dir: string): Promise<void> {
		return invoke<void>("settings_set_download_dir", { dir });
	}

	async setProxy(proxy: string | null): Promise<void> {
		return invoke<void>("settings_set_proxy", { proxy: proxy || null });
	}

	async setTrackers(trackers: string[]): Promise<void> {
		return invoke<void>("settings_set_trackers", { trackers });
	}

	async setTrackerOptions(options: {
		sourceType: string | null;
		cdn: string | null;
		customUrl: string | null;
		autoUpdate: boolean | null;
		lastUpdateTime: number | null;
	}): Promise<void> {
		return invoke<void>("settings_set_tracker_options", {
			sourceType: options.sourceType,
			cdn: options.cdn,
			customUrl: options.customUrl,
			autoUpdate: options.autoUpdate,
			lastUpdateTime: options.lastUpdateTime,
		});
	}

	async setAiConfigs(configs: AiConfig[] | null): Promise<void> {
		return invoke<void>("settings_set_ai_configs", { configs });
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
		return invoke<string | null>("select_directory");
	}
}
