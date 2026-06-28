export interface SettingsRepository {
	getSettings(): Promise<{
		download_dir: string;
		proxy?: string | null;
		trackers?: string[];
	}>;
	setDownloadDir(dir: string): Promise<void>;
	setProxy(proxy: string | null): Promise<void>;
	setTrackers(trackers: string[]): Promise<void>;
	selectDirectory(): Promise<string | null>;
}
