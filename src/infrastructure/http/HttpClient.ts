import type { Context } from "ajanuw-context";

export interface HttpClientOptions extends RequestInit {
  ctx?: Context;
}

/** HTTP 客户端契约（端口）：仓库与 AI 客户端依赖此接口，测试可注入假实现。 */
export interface HttpClient {
  request(url: string | URL, options?: HttpClientOptions): Promise<Response>;
  getJson<T>(url: string | URL, options?: HttpClientOptions): Promise<T>;
}

/** 基于 fetch 的默认实现，负责 Context 取消与响应错误归一化。 */
export class FetchHttpClient implements HttpClient {
  private readonly defaultHeaders: HeadersInit;

  constructor(defaults: { headers?: HeadersInit } = {}) {
    this.defaultHeaders = defaults.headers || {};
  }

  private setupContextAbort(
    ctx: Context | undefined,
    controller: AbortController,
  ): void {
    if (!ctx) return;
    if (ctx.err()) {
      throw ctx.err();
    }
    ctx.done().then(() => {
      controller.abort(ctx.err() || undefined);
    });
  }

  async request(
    url: string | URL,
    options: HttpClientOptions = {},
  ): Promise<Response> {
    const { ctx, headers, ...restOptions } = options;
    const controller = new AbortController();

    this.setupContextAbort(ctx, controller);

    const response = await fetch(url, {
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
    url: string | URL,
    options: HttpClientOptions = {},
  ): Promise<T> {
    const response = await this.request(url, {
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
