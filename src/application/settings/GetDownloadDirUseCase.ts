import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class GetDownloadDirUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  async execute(): Promise<{ downloadDir: string }> {
    const settings = await this.settingsRepository.getSettings();
    return { downloadDir: settings.download_dir };
  }
}
