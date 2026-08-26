import { Background, Canceled, WithCancel } from "ajanuw-context";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchHttpClient } from "./HttpClient";

describe("HttpClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("能够成功发送 GET 请求并解析 JSON", async () => {
    const mockData = { foo: "bar" };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const client = new FetchHttpClient();
    const result = await client.getJson("https://api.example.com/test");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/test",
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json" },
      }),
    );
    expect(result).toEqual(mockData);
  });

  it("在 HTTP 响应不成功时抛出错误", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const client = new FetchHttpClient();
    await expect(
      client.getJson("https://api.example.com/test"),
    ).rejects.toThrow("HTTP error! status: 404 Not Found");
  });

  it("如果 Context 在请求前已被取消，应立即抛出 Context 错误", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const [ctx, cancel] = WithCancel(Background);
    cancel();

    const client = new FetchHttpClient();
    await expect(
      client.getJson("https://api.example.com/test", { ctx }),
    ).rejects.toThrow(Canceled.message);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("应将 params 序列化并拼接到 URL 查询字符串", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const client = new FetchHttpClient();
    await client.getJson("https://api.example.com/test", {
      params: { keyword: "动画", type: 2, nsfw: false },
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    const parsed = new URL(calledUrl);
    expect(parsed.searchParams.get("keyword")).toBe("动画");
    expect(parsed.searchParams.get("type")).toBe("2");
    expect(parsed.searchParams.get("nsfw")).toBe("false");
  });

  it("应忽略 params 中值为 undefined 的字段", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const client = new FetchHttpClient();
    await client.getJson("https://api.example.com/test", {
      params: { a: "1", b: undefined, c: "3" },
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    const parsed = new URL(calledUrl);
    expect(parsed.searchParams.get("a")).toBe("1");
    expect(parsed.searchParams.has("b")).toBe(false);
    expect(parsed.searchParams.get("c")).toBe("3");
  });

  it("应正确合并 URL 已有的查询参数与 params", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const client = new FetchHttpClient();
    await client.getJson("https://api.example.com/test?existing=yes", {
      params: { added: "true" },
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    const parsed = new URL(calledUrl);
    expect(parsed.searchParams.get("existing")).toBe("yes");
    expect(parsed.searchParams.get("added")).toBe("true");
  });
});
