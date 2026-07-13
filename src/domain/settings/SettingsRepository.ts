import type { AiConfig, Settings } from "./SettingsSchemas";

export interface SettingsRepository {
	getSettings(): Promise<Settings>;
	setDownloadDir(dir: string): Promise<void>;
	setProxy(proxy: string | null): Promise<void>;
	setTrackers(trackers: string[]): Promise<void>;
	setTrackerOptions(options: {
		sourceType: string | null;
		cdn: string | null;
		customUrl: string | null;
		autoUpdate: boolean | null;
		lastUpdateTime: number | null;
	}): Promise<void>;
	setAiConfigs(configs: AiConfig[] | null): Promise<void>;
	fetchTrackers(url: string): Promise<string[]>;
	selectDirectory(): Promise<string | null>;
	setTheme(theme: string): Promise<void>;
}
