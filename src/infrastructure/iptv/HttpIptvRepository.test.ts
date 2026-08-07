import { Background, Canceled, WithCancel } from "ajanuw-context";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../http/HttpClient";
import { HttpIptvRepository } from "./HttpIptvRepository";

describe("HttpIptvRepository", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getCountries 应该能够成功获取并解析国家列表", async () => {
    const mockResponse = [
      { name: "China", code: "CN", flag: "🇨🇳", languages: ["zho"] },
      { name: "Japan", code: "JP", flag: "🇯🇵" },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const repository = new HttpIptvRepository(new HttpClient());
    const result = await repository.getCountries(Background);

    expect(result).toHaveLength(2);
    expect(result[0].code).toBe("CN");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("countries.json"),
      expect.any(Object),
    );
  });

  it("getCountries 在响应结构不匹配时应抛出带 cause 的错误", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ name: "No Code" }],
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const repository = new HttpIptvRepository(new HttpClient());
    await expect(repository.getCountries(Background)).rejects.toThrow(
      "IPTV countries response structure mismatch",
    );
  });

  it("getCountries 在网络请求失败时应抛出带 cause 的错误", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const repository = new HttpIptvRepository(new HttpClient());
    await expect(repository.getCountries(Background)).rejects.toThrow(
      "Failed to fetch IPTV countries",
    );
  });

  it("getChannels 应该按小写国家代码请求 m3u 并解析出频道", async () => {
    const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="CCTV1.cn@HD" tvg-logo="https://i.imgur.com/TpA3cUl.png" group-title="General",CCTV-1 (1080p)
http://69.30.245.50/live/cctv1.m3u8`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => m3u,
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const repository = new HttpIptvRepository(new HttpClient());
    const result = await repository.getChannels(Background, "CN");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("CCTV-1 (1080p)");
    expect(result[0].category).toBe("General");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("countries/cn.m3u"),
      expect.any(Object),
    );
  });

  it("getChannels 在网络请求失败时应抛出带 cause 的错误", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const repository = new HttpIptvRepository(new HttpClient());
    await expect(repository.getChannels(Background, "XX")).rejects.toThrow(
      "Failed to fetch IPTV channels",
    );
  });

  it("getCountries 在 Context 取消时应透传取消错误而不二次包装", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const [ctx, cancel] = WithCancel(Background);
    cancel();

    const repository = new HttpIptvRepository(new HttpClient());
    await expect(repository.getCountries(ctx)).rejects.toThrow(
      Canceled.message,
    );
  });
});
