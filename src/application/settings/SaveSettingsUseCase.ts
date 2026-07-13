import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export interface SaveSettingsDto {
	downloadDir: string;
	proxy: string | null;
	trackers: string[];
	trackerSourceType?: string | null;
	trackerCdn?: string | null;
	trackerCustomUrl?: string | null;
	trackerAutoUpdate?: boolean | null;
	trackerLastUpdateTime?: number | null;
	aiConfigs?:
		| {
				alias: string;
				apiEndpoint: string;
				apiKey: string;
				model?: string | null;
		  }[]
		| null;
}

export class SaveSettingsUseCase {
	constructor(private settingsRepository: SettingsRepository) {}

	async execute(dto: SaveSettingsDto): Promise<void> {
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
		if (dto.aiConfigs !== undefined) {
			const configs = dto.aiConfigs
				? dto.aiConfigs.map((c) => ({
						alias: c.alias,
						api_endpoint: c.apiEndpoint,
						api_key: c.apiKey,
						ai_model: c.model ?? null,
					}))
				: null;
			await this.settingsRepository.setAiConfigs(configs);
		}
	}
}
