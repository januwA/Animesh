import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SaveSettingsUseCase {
	constructor(private settingsRepository: SettingsRepository) {}

	async execute(dto: {
		downloadDir: string;
		proxy: string | null;
		trackers: string[];
		trackerSourceType?: string | null;
		trackerCdn?: string | null;
		trackerCustomUrl?: string | null;
		trackerAutoUpdate?: boolean | null;
		trackerLastUpdateTime?: number | null;
	}): Promise<void> {
		await this.settingsRepository.setDownloadDir(dto.downloadDir);
		await this.settingsRepository.setProxy(dto.proxy);
		await this.settingsRepository.setTrackers(dto.trackers);
		await this.settingsRepository.setTrackerOptions({
			sourceType: dto.trackerSourceType ?? null,
			cdn: dto.trackerCdn ?? null,
			customUrl: dto.trackerCustomUrl ?? null,
			autoUpdate: dto.trackerAutoUpdate ?? null,
			lastUpdateTime: dto.trackerLastUpdateTime ?? null,
		});
	}
}
