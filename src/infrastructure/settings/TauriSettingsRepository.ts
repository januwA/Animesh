import { invoke } from "@tauri-apps/api/core";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class TauriSettingsRepository implements SettingsRepository {
	async getSettings(): Promise<{ download_dir: string }> {
		return invoke<{ download_dir: string }>("settings_get");
	}

	async setDownloadDir(dir: string): Promise<void> {
		return invoke<void>("settings_set_download_dir", { dir });
	}

	async selectDirectory(): Promise<string | null> {
		return invoke<string | null>("select_directory");
	}
}
