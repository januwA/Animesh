import type { Settings } from "./SettingsSchemas";

export interface SettingsRepository {
	getSettings(): Promise<Settings>;
	setDownloadDir(dir: string): Promise<void>;
	setProxy(proxy: string | null): Promise<void>;
	setTrackers(trackers: string[]): Promise<void>;
	selectDirectory(): Promise<string | null>;
}
