export interface UpdateInfo {
	version: string;
	notes: string;
	pubDate?: string;
	url?: string;
	htmlUrl: string;
}

export interface UpdateCheckResult {
	hasUpdate: boolean;
	latestVersion: string;
	currentVersion: string;
	notes: string;
	url?: string;
	htmlUrl: string;
}
