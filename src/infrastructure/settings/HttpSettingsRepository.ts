import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import {
  type AiConfig,
  type Settings,
  SettingsSchema,
} from "../../domain/settings/SettingsSchemas";
import { HttpClient } from "../http/HttpClient";

const baseUrl = import.meta.env.PROD
  ? "/api"
  : (import.meta.env.VITE_API_BASE_URL as string) || "/api";

export class HttpSettingsRepository implements SettingsRepository {
  private readonly httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient();
  }

  async getSettings(): Promise<Settings> {
    const rawSettings = await this.httpClient.getJson<unknown>(
      `${baseUrl}/settings`,
    );

    const result = SettingsSchema.safeParse(rawSettings);
    if (!result.success) {
      throw new Error("Settings backend structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async setDownloadDir(dir: string): Promise<void> {
    await this.httpClient.request(`${baseUrl}/settings/download-dir`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dir }),
    });
  }

  async setProxy(proxy: string | null): Promise<void> {
    await this.httpClient.request(`${baseUrl}/settings/proxy`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ proxy }),
    });
  }

  async setAiConfigs(configs: AiConfig[] | null): Promise<void> {
    await this.httpClient.request(`${baseUrl}/settings/ai-configs`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ configs }),
    });
  }

  async setMaxDownloadSpeed(speed: number | null): Promise<void> {
    await this.httpClient.request(`${baseUrl}/settings/max-download-speed`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_speed: speed }),
    });
  }

  async selectDirectory(): Promise<string | null> {
    // Web version doesn't support directory selection dialog
    return null;
  }

  async setTheme(_theme: string): Promise<void> {
    // Web version doesn't support native window theme sync
  }
}
