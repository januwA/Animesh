import { invoke } from "@tauri-apps/api/core";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import {
  type AiConfig,
  type Settings,
  SettingsSchema,
} from "../../domain/settings/SettingsSchemas";

export class TauriSettingsRepository implements SettingsRepository {
  async getSettings(): Promise<Settings> {
    const rawSettings = await invoke<unknown>("settings_get");
    const result = SettingsSchema.safeParse(rawSettings);
    if (!result.success) {
      throw new Error("Settings backend structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async setDownloadDir(dir: string): Promise<void> {
    return invoke<void>("settings_set_download_dir", { dir });
  }

  async setProxy(proxy: string | null): Promise<void> {
    return invoke<void>("settings_set_proxy", { proxy: proxy || null });
  }

  async setAiConfigs(configs: AiConfig[] | null): Promise<void> {
    return invoke<void>("settings_set_ai_configs", { configs });
  }

  async setMaxDownloadSpeed(speed: number | null): Promise<void> {
    return invoke<void>("settings_set_max_download_speed", {
      maxSpeed: speed,
    });
  }

  async setMaxUploadSpeed(speed: number | null): Promise<void> {
    return invoke<void>("settings_set_max_upload_speed", {
      maxSpeed: speed,
    });
  }

  async selectDirectory(): Promise<NonEmptyString | null> {
    return invoke<NonEmptyString | null>("select_directory");
  }

  async setTheme(theme: "light" | "dark" | null): Promise<void> {
    const { setTheme } = await import("@tauri-apps/api/app");
    await setTheme(theme);
  }
}
