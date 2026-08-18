import type { NonEmptyString } from "../common/NonEmptyString";
import type { AiConfig, Settings } from "./SettingsSchemas";

export interface SettingsRepository {
  getSettings(): Promise<Settings>;
  setDownloadDir(dir: NonEmptyString): Promise<void>;
  setProxy(proxy: NonEmptyString | null): Promise<void>;
  setAiConfigs(configs: AiConfig[] | null): Promise<void>;
  setMaxDownloadSpeed(speed: number | null): Promise<void>;
  setMaxUploadSpeed(speed: number | null): Promise<void>;
  selectDirectory(): Promise<NonEmptyString | null>;
  setTheme(theme?: "light" | "dark" | null): Promise<void>;
}
