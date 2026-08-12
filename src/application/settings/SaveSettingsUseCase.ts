import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export interface SaveSettingsDto {
  downloadDir: string;
  proxy: string | null;
  aiConfigs?:
    | {
        alias: string;
        apiEndpoint: string;
        apiKey: string;
        model?: string | null;
      }[]
    | null;
  maxDownloadSpeed?: number | null;
}

export class SaveSettingsUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  async execute(dto: SaveSettingsDto): Promise<void> {
    await this.settingsRepository.setDownloadDir(dto.downloadDir);
    await this.settingsRepository.setProxy(dto.proxy);
    if (dto.aiConfigs !== undefined) {
      const configs = dto.aiConfigs
        ? dto.aiConfigs.map((c) => ({
            alias: c.alias,
            api_endpoint: c.apiEndpoint,
            api_key: c.apiKey,
            ai_model: c.model ?? null,
          }))
        : null;
      await this.settingsRepository.setAiConfigs(configs);
    }
    if (dto.maxDownloadSpeed !== undefined) {
      await this.settingsRepository.setMaxDownloadSpeed(
        dto.maxDownloadSpeed ?? null,
      );
    }
  }
}
