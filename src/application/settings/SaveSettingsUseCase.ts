import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";

export interface SaveSettingsDto {
  downloadDir: string;
  proxy: string;
  aiConfigs?: AiConfig[] | null;
  maxDownloadSpeed?: number | null;
  maxUploadSpeed?: number | null;
}

export class SaveSettingsUseCase {
  constructor(private settingsRepository: SettingsRepository) {}

  async execute(dto: SaveSettingsDto): Promise<void> {
    const downloadDir = NonEmptyStringSchema.safeParse(dto.downloadDir);
    if (downloadDir.success) {
      await this.settingsRepository.setDownloadDir(downloadDir.data);
    }
    const proxy = NonEmptyStringSchema.safeParse(dto.proxy);
    if (proxy.success) {
      await this.settingsRepository.setProxy(proxy.data);
    }
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
