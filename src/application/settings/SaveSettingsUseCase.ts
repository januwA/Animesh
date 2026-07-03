import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SaveSettingsUseCase {
	constructor(private settingsRepository: SettingsRepository) {}

	async execute(dto: {
		downloadDir: string;
		proxy: string | null;
		trackers: string[];
	}): Promise<void> {
		await this.settingsRepository.setDownloadDir(dto.downloadDir);
		await this.settingsRepository.setProxy(dto.proxy);
		await this.settingsRepository.setTrackers(dto.trackers);
	}
}
