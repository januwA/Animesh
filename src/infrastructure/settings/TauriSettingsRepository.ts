import { invoke } from "@tauri-apps/api/core";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import {
	type Settings,
	SettingsSchema,
} from "../../domain/settings/SettingsSchemas";

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

	async selectDirectory(): Promise<string | null> {
		return invoke<string | null>("select_directory");
	}
}
