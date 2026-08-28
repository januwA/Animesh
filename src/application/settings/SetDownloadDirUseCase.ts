import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SetDownloadDirUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  execute(dir: string): Promise<void> {
    return this.settingsRepository.setDownloadDir(dir);
  }
}
