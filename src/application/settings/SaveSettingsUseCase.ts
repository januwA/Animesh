import type { Settings } from "@/domain/settings/SettingsSchemas";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SaveSettingsUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  async execute(dto: Settings): Promise<void> {
    await this.settingsRepository.setDownloadDir(dto.download_dir);
    await this.settingsRepository.setProxy(dto.proxy);
    await this.settingsRepository.setAiConfigs(dto.ai_configs);
    await this.settingsRepository.setMaxDownloadSpeed(dto.max_download_speed);
    await this.settingsRepository.setMaxUploadSpeed(dto.max_upload_speed);
    await this.settingsRepository.setTranslationConfig(dto.translation);
  }
}
