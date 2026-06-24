export interface SettingsRepository {
	getSettings(): Promise<{ download_dir: string; proxy?: string | null }>;
	setDownloadDir(dir: string): Promise<void>;
	setProxy(proxy: string | null): Promise<void>;
	selectDirectory(): Promise<string | null>;
}
