import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SetThemeUseCase {
	constructor(private readonly settingsRepository: SettingsRepository) {}

	async execute(theme: string): Promise<void> {
		return this.settingsRepository.setTheme(theme);
	}
}
