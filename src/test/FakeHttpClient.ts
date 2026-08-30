import { vi } from "vitest";
import type { HttpClient } from "@/domain/http/HttpClient";

export type FakeHttpClient = HttpClient & {
  getJson: ReturnType<typeof vi.fn>;
  request: ReturnType<typeof vi.fn>;
};

/** 构造一个可注入仓库的 HttpClient 假实现，用 mock 函数隔离真实 fetch。 */
export function createFakeHttpClient(): FakeHttpClient {
  return {
    getJson: vi.fn(),
    request: vi.fn(),
  } as unknown as FakeHttpClient;
}
