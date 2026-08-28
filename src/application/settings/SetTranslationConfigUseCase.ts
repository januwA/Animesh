import type { TranslationConfig } from "@/domain/settings/SettingsSchemas";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SetTranslationConfigUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  execute(config: TranslationConfig): Promise<void> {
    return this.settingsRepository.setTranslationConfig(config);
  }
}
