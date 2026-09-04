import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class GetAiConfigsUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  async execute(): Promise<{ aiConfigs: AiConfig[] }> {
    const settings = await this.settingsRepository.getSettings();
    return { aiConfigs: settings.ai_configs ?? [] };
  }
}
