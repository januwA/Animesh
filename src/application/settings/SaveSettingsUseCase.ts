import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export interface SaveSettingsDto {
  downloadDir: string;
  proxy: string | null;
  aiConfigs?: AiConfig[] | null;
  maxDownloadSpeed?: number | null;
  maxUploadSpeed?: number | null;
}

export class SaveSettingsUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  async execute(dto: SaveSettingsDto): Promise<void> {
    await this.settingsRepository.setDownloadDir(
      NonEmptyStringSchema.parse(dto.downloadDir),
    );
    await this.settingsRepository.setProxy(
      NonEmptyStringSchema.parse(dto.proxy),
    );
    if (dto.aiConfigs !== undefined) {
      await this.settingsRepository.setAiConfigs(dto.aiConfigs);
    }
    if (dto.maxDownloadSpeed !== undefined) {
      await this.settingsRepository.setMaxDownloadSpeed(dto.maxDownloadSpeed);
    }
    if (dto.maxUploadSpeed !== undefined) {
      await this.settingsRepository.setMaxUploadSpeed(dto.maxUploadSpeed);
    }
  }
}
