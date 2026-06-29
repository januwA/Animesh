import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import type { Settings } from "../../domain/settings/SettingsSchemas";

export class GetSettingsUseCase {
	constructor(private settingsRepository: SettingsRepository) {}

	execute(): Promise<Settings> {
		return this.settingsRepository.getSettings();
	}
}
