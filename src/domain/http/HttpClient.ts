import type { Context } from "ajanuw-context";

export interface HttpClientOptions extends RequestInit {
  ctx?: Context;
  params?: Record<string, string | number | boolean | undefined>;
}
/** HTTP 客户端契约（端口）：仓库与 AI 客户端依赖此接口，测试可注入假实现。 */

export interface HttpClient {
  request(url: string | URL, options?: HttpClientOptions): Promise<Response>;
  getJson<T>(url: string | URL, options?: HttpClientOptions): Promise<T>;
}
