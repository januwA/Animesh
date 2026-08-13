import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SetThemeUseCase {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async execute(theme?: string | null): Promise<void> {
    if (theme !== "light" && theme !== "dark") theme = null;
    return this.settingsRepository.setTheme(theme);
  }
}
