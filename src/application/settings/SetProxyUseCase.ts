import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export class SetProxyUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  execute(proxy: string | null): Promise<void> {
    return this.settingsRepository.setProxy(proxy);
  }
}
