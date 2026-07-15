import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class GetDefaultTrackersUseCase {
	constructor(private settingsRepository: SettingsRepository) {}

	execute(): Promise<string[]> {
		return this.settingsRepository.getDefaultTrackers();
	}
}
