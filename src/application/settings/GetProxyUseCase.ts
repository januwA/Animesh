import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class GetProxyUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  async execute(): Promise<{ proxy: string | null }> {
    const settings = await this.settingsRepository.getSettings();
    return { proxy: settings.proxy };
  }
}
