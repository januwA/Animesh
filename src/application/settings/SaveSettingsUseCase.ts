import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SaveSettingsUseCase {
	constructor(private settingsRepository: SettingsRepository) {}

	async execute(
		downloadDir: string,
		proxy: string | null,
		trackers: string[],
	): Promise<void> {
		await this.settingsRepository.setDownloadDir(downloadDir);
		await this.settingsRepository.setProxy(proxy);
		await this.settingsRepository.setTrackers(trackers);
	}
}
