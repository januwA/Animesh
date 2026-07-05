import type { UpdateInfo } from "./UpdateInfo";

export interface UpdateRepository {
	getLatestRelease(): Promise<UpdateInfo>;
	getCurrentVersion(): Promise<string>;
	openUrl(url: string): Promise<void>;
}
