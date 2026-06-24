import { invoke } from "@tauri-apps/api/core";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class TauriSettingsRepository implements SettingsRepository {
	async getSettings(): Promise<{
		download_dir: string;
		proxy?: string | null;
	}> {
		return invoke<{ download_dir: string; proxy?: string | null }>(
			"settings_get",
		);
	}

	async setDownloadDir(dir: string): Promise<void> {
		return invoke<void>("settings_set_download_dir", { dir });
	}

	async setProxy(proxy: string | null): Promise<void> {
		return invoke<void>("settings_set_proxy", { proxy: proxy || null });
	}

	async selectDirectory(): Promise<string | null> {
		return invoke<string | null>("select_directory");
	}
}
