import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TauriIptvStreamUrlRepository } from "./TauriIptvStreamUrlRepository";

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

describe("基础设施层 TauriIptvStreamUrlRepository", () => {
  let repository: TauriIptvStreamUrlRepository;

  beforeEach(() => {
    repository = new TauriIptvStreamUrlRepository();
    mockInvoke.mockResolvedValue({
      proxy_url: "http://127.0.0.1:45678/iptv-proxy",
      kind: "hls",
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("对 http 地址应返回经本地代理的 URL 及流类型", async () => {
    const result = await repository.resolvePlayableStreamUrl(
      "http://example.com/live.m3u8",
    );

    expect(result).toEqual({
      url: "http://127.0.0.1:45678/iptv-proxy?url=http%3A%2F%2Fexample.com%2Flive.m3u8",
      kind: "hls",
    });
    expect(mockInvoke).toHaveBeenCalledWith("iptv_resolve_stream", {
      rawUrl: "http://example.com/live.m3u8",
    });
  });

  it("对 https 地址也应返回经本地代理的 URL", async () => {
    const result = await repository.resolvePlayableStreamUrl(
      "https://example.com/live/index.m3u8?auth=test",
    );

    expect(result.url).toBe(
      "http://127.0.0.1:45678/iptv-proxy?url=https%3A%2F%2Fexample.com%2Flive%2Findex.m3u8%3Fauth%3Dtest",
    );
  });

  it("当后端判定为 FLV 时应透传流类型", async () => {
    mockInvoke.mockResolvedValue({
      proxy_url: "http://127.0.0.1:45678/iptv-proxy",
      kind: "flv",
    });
    const result = await repository.resolvePlayableStreamUrl(
      "http://example.com/live.flv",
    );

    expect(result.kind).toBe("flv");
  });

  it("对非 http 协议地址应原样返回且不调用后端", async () => {
    const result = await repository.resolvePlayableStreamUrl(
      "rtmp://example.com/live",
    );

    expect(result).toEqual({ url: "rtmp://example.com/live", kind: "unknown" });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("当后端返回的代理地址带尾部斜杠时应去除", async () => {
    mockInvoke.mockResolvedValue({
      proxy_url: "http://127.0.0.1:45678/iptv-proxy/",
      kind: "hls",
    });
    const result = await repository.resolvePlayableStreamUrl(
      "http://example.com/live.m3u8",
    );

    expect(result.url).toBe(
      "http://127.0.0.1:45678/iptv-proxy?url=http%3A%2F%2Fexample.com%2Flive.m3u8",
    );
  });

  it("当后端调用失败时应抛出错误", async () => {
    mockInvoke.mockRejectedValue(new Error("command not found"));

    await expect(
      repository.resolvePlayableStreamUrl("http://example.com/live.m3u8"),
    ).rejects.toThrow("command not found");
  });

  it("当后端返回结构不匹配时应抛出错误", async () => {
    mockInvoke.mockResolvedValue(12345);

    await expect(
      repository.resolvePlayableStreamUrl("http://example.com/live.m3u8"),
    ).rejects.toThrow("iptv_resolve_stream API structure mismatch");
  });
});
