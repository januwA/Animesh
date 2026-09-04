import type { Context } from "ajanuw-context";
import type { HttpClient, HttpClientOptions } from "@/domain/http/HttpClient";
import type { Logger } from "@/domain/logger/logger";
import { Logged } from "../logger/LoggedDecorator";

/** 基于 fetch 的默认实现，负责 Context 取消与响应错误归一化。 */
export class FetchHttpClient implements HttpClient {
  private readonly defaultHeaders: HeadersInit;

  constructor(
    defaults: { headers?: HeadersInit } = {},
    public readonly logger: Logger,
  ) {
    this.defaultHeaders = defaults.headers || {};
  }

  private setupContextAbort(ctx: Context, controller: AbortController): void {
    if (ctx.err()) {
      throw ctx.err();
    }
    ctx.done().then(() => {
      controller.abort(ctx.err() || undefined);
    });
  }

  private appendParams(
    url: string | URL,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    if (!params) return url.toString();
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.append(key, String(value));
    }
    const queryString = searchParams.toString();
    if (!queryString) return url.toString();
    const separator = url.toString().includes("?") ? "&" : "?";
    return `${url}${separator}${queryString}`;
  }

  @Logged()
  async request(
    ctx: Context,
    url: string | URL,
    options: HttpClientOptions = {},
  ): Promise<Response> {
    const { headers, params, ...restOptions } = options;
    const controller = new AbortController();

    this.setupContextAbort(ctx, controller);

    const finalUrl = this.appendParams(url, params);

    const response = await fetch(finalUrl, {
      ...restOptions,
      signal: controller.signal,
      headers: {
        ...this.defaultHeaders,
        ...headers,
      },
    });

    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status} ${response.statusText}`,
      );
    }

    return response;
  }

  async getJson<T>(
    ctx: Context,
    url: string | URL,
    options: HttpClientOptions = {},
  ): Promise<T> {
    const response = await this.request(ctx, url, {
      ...options,
      method: "GET",
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });
    return response.json() as Promise<T>;
  }
}
