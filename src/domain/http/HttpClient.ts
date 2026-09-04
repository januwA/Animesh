import type { Context } from "ajanuw-context";

export interface HttpClientOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export interface HttpClient {
  request(
    ctx: Context,
    url: string | URL,
    options?: HttpClientOptions,
  ): Promise<Response>;
  getJson<T>(
    ctx: Context,
    url: string | URL,
    options?: HttpClientOptions,
  ): Promise<T>;
}
