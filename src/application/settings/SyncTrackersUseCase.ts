import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SyncTrackersUseCase {
	constructor(private settingsRepository: SettingsRepository) {}

	async execute(url: string): Promise<string[]> {
		return this.settingsRepository.fetchTrackers(url);
	}
}
