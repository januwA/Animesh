import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SetSpeedLimitsUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  async execute(
    maxDownloadSpeed: number,
    maxUploadSpeed: number,
  ): Promise<void> {
    await this.settingsRepository.setMaxDownloadSpeed(maxDownloadSpeed);
    await this.settingsRepository.setMaxUploadSpeed(maxUploadSpeed);
  }
}
