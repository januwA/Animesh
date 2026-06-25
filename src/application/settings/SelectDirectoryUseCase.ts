import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SelectDirectoryUseCase {
	constructor(private settingsRepository: SettingsRepository) {}

	execute(): Promise<string | null> {
		return this.settingsRepository.selectDirectory();
	}
}
