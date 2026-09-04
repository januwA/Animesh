import { invoke } from "@tauri-apps/api/core";
import { Background } from "ajanuw-context";
import { Duration } from "ajanuw-duration";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { CacheStore } from "@/domain/storage/CacheStore";
import { commands } from "@/generated/tauri-commands";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import {
  type AiConfig,
  type Settings,
  SettingsSchema,
  type TranslationConfig,
} from "../../domain/settings/SettingsSchemas";
import { Cached } from "../cache/CachedDecorator";

const SETTINGS_CACHE_PREFIX = "UserSetings";

export class TauriSettingsRepository implements SettingsRepository {
  constructor(public readonly store: CacheStore) {}

  @Cached({
    prefix: SETTINGS_CACHE_PREFIX,
    ttl: new Duration({ days: 360 }),
  })
  async getSettings(): Promise<Settings> {
    const rawSettings = await invoke<unknown>(commands.settings_get);
    const result = SettingsSchema.safeParse(rawSettings);
    if (!result.success) {
      throw new Error("Settings backend structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async setDownloadDir(dir: string): Promise<void> {
    await invoke<void>(commands.settings_set_download_dir, { dir });
    await this.store.clearByPrefix(Background, SETTINGS_CACHE_PREFIX);
  }

  async setProxy(proxy: string | null): Promise<void> {
    await invoke<void>(commands.settings_set_proxy, { proxy });
    await this.store.clearByPrefix(Background, SETTINGS_CACHE_PREFIX);
  }

  async setAiConfigs(configs: AiConfig[] | null): Promise<void> {
    await invoke<void>(commands.settings_set_ai_configs, { configs });
    await this.store.clearByPrefix(Background, SETTINGS_CACHE_PREFIX);
  }

  async setMaxDownloadSpeed(speed: number | null): Promise<void> {
    await invoke<void>(commands.settings_set_max_download_speed, {
      maxSpeed: speed,
    });
    await this.store.clearByPrefix(Background, SETTINGS_CACHE_PREFIX);
  }

  async setMaxUploadSpeed(speed: number | null): Promise<void> {
    await invoke<void>(commands.settings_set_max_upload_speed, {
      maxSpeed: speed,
    });
    await this.store.clearByPrefix(Background, SETTINGS_CACHE_PREFIX);
  }

  async setTranslationConfig(config: TranslationConfig): Promise<void> {
    await invoke<void>(commands.settings_set_translation_config, { config });
    await this.store.clearByPrefix(Background, SETTINGS_CACHE_PREFIX);
  }

  async selectDirectory(): Promise<NonEmptyString | null> {
    return invoke<NonEmptyString | null>(commands.select_directory);
  }

  async setTheme(theme: "light" | "dark" | null): Promise<void> {
    const { setTheme } = await import("@tauri-apps/api/app");
    await setTheme(theme);
  }
}
