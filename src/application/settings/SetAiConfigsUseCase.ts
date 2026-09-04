import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SetAiConfigsUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  execute(configs: AiConfig[]): Promise<void> {
    return this.settingsRepository.setAiConfigs(configs);
  }
}
