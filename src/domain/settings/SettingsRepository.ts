import type { NonEmptyString } from "../common/NonEmptyString";
import type { AiConfig, Settings } from "./SettingsSchemas";

export interface SettingsRepository {
  getSettings(): Promise<Settings>;
  setDownloadDir(dir: string): Promise<void>;
  setProxy(proxy: string | null): Promise<void>;
  setAiConfigs(configs: AiConfig[] | null): Promise<void>;
  setMaxDownloadSpeed(speed: number | null): Promise<void>;
  setMaxUploadSpeed(speed: number | null): Promise<void>;
  selectDirectory(): Promise<NonEmptyString | null>;
  setTheme(theme?: "light" | "dark" | null): Promise<void>;
}
