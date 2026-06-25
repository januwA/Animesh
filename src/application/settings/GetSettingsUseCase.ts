import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class GetSettingsUseCase {
	constructor(private settingsRepository: SettingsRepository) {}

	execute(): Promise<{ download_dir: string; proxy?: string | null }> {
		return this.settingsRepository.getSettings();
	}
}
