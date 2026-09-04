import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class GetSpeedLimitsUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  async execute(): Promise<{
    maxDownloadSpeed: number;
    maxUploadSpeed: number;
  }> {
    const settings = await this.settingsRepository.getSettings();
    return {
      maxDownloadSpeed: settings.max_download_speed ?? 0,
      maxUploadSpeed: settings.max_upload_speed ?? 0,
    };
  }
}
