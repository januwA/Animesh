import type { TranslationConfig } from "@/domain/settings/SettingsSchemas";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class GetTranslationConfigUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  async execute(): Promise<TranslationConfig> {
    const settings = await this.settingsRepository.getSettings();
    return settings.translation;
  }
}
