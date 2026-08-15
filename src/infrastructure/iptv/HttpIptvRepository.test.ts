import { Background, Canceled, WithCancel } from "ajanuw-context";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeHttpClient } from "../../test/FakeHttpClient";
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

    const client = createFakeHttpClient();
    client.getJson.mockResolvedValue(mockResponse);

    const repository = new HttpIptvRepository(client);
    const result = await repository.getCountries(Background);

    expect(result).toHaveLength(2);
    expect(result[0].code).toBe("CN");
    expect(client.getJson).toHaveBeenCalledWith(
      expect.stringContaining("countries.json"),
      expect.anything(),
    );
  });

  it("getCountries 在响应结构不匹配时应抛出带 cause 的错误", async () => {
    const client = createFakeHttpClient();
    client.getJson.mockResolvedValue([{ name: "No Code" }]);

    const repository = new HttpIptvRepository(client);
    await expect(repository.getCountries(Background)).rejects.toThrow(
      "IPTV countries response structure mismatch",
    );
  });

  it("getCountries 在网络请求失败时应抛出带 cause 的错误", async () => {
    const client = createFakeHttpClient();
    client.getJson.mockRejectedValue(
      new Error("HTTP error! status: 500 Internal Server Error"),
    );

    const repository = new HttpIptvRepository(client);
    await expect(repository.getCountries(Background)).rejects.toThrow(
      "Failed to fetch IPTV countries",
    );
  });

  it("getChannels 应该按小写国家代码请求 m3u 并解析出频道", async () => {
    const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="CCTV1.cn@HD" tvg-logo="https://i.imgur.com/TpA3cUl.png" group-title="General",CCTV-1 (1080p)
http://69.30.245.50/live/cctv1.m3u8`;

    const client = createFakeHttpClient();
    client.request.mockResolvedValue({ text: async () => m3u } as Response);

    const repository = new HttpIptvRepository(client);
    const result = await repository.getChannels(Background, "CN");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("CCTV-1 (1080p)");
    expect(result[0].category).toBe("General");
    expect(client.request).toHaveBeenCalledWith(
      expect.stringContaining("countries/cn.m3u"),
      expect.anything(),
    );
  });

  it("getChannels 在网络请求失败时应抛出带 cause 的错误", async () => {
    const client = createFakeHttpClient();
    client.request.mockRejectedValue(
      new Error("HTTP error! status: 404 Not Found"),
    );

    const repository = new HttpIptvRepository(client);
    await expect(repository.getChannels(Background, "XX")).rejects.toThrow(
      "Failed to fetch IPTV channels",
    );
  });

  it("getCountries 在 Context 取消时应透传取消错误而不二次包装", async () => {
    const [ctx, cancel] = WithCancel(Background);
    cancel();

    const client = createFakeHttpClient();
    client.getJson.mockRejectedValue(ctx.err());

    const repository = new HttpIptvRepository(client);
    await expect(repository.getCountries(ctx)).rejects.toThrow(
      Canceled.message,
    );
  });
});
