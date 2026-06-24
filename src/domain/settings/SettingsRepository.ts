export interface SettingsRepository {
	getSettings(): Promise<{ download_dir: string }>;
	setDownloadDir(dir: string): Promise<void>;
	selectDirectory(): Promise<string | null>;
}
