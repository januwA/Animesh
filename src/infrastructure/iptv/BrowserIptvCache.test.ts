import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IptvChannel, IptvCountry } from "@/domain/iptv/IptvSchemas";
import { InMemoryCacheStore } from "@/test/InMemoryCacheStore";
import { BrowserIptvCache } from "./BrowserIptvCache";

describe("BrowserIptvCache 浏览器缓存实现", () => {
  let cache: BrowserIptvCache;
  let store: InMemoryCacheStore;

  const mockCountries: IptvCountry[] = [
    { name: "China", code: "CN", flag: "🇨🇳", languages: ["zho"] },
  ];

  const mockChannels: IptvChannel[] = [
    {
      tvgId: "CCTV1.cn@HD",
      name: "CCTV-1 (1080p)",
      logo: "https://example.com/logo.png",
      category: "General",
      url: "https://example.com/stream.m3u8",
    },
  ];

  beforeEach(() => {
    store = new InMemoryCacheStore();
    vi.useRealTimers();
    cache = new BrowserIptvCache(store);
  });

  describe("countries 缓存", () => {
    const cacheKey = "iptv:countries";

    it("当没有缓存时，应该返回 null", async () => {
      const result = await cache.getCountries(Background);
      expect(result).toBeNull();
    });

    it("当成功缓存且未过期时，应该能够正确读取缓存数据", async () => {
      await cache.setCountries(Background, mockCountries);
      const result = await cache.getCountries(Background);
      expect(result).toEqual(mockCountries);
    });

    it("当缓存已过期（超过30天）时，应该返回 null 并清除缓存", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const now = Date.now();
      vi.setSystemTime(now);

      await cache.setCountries(Background, mockCountries);
      vi.setSystemTime(now + 30 * 24 * 60 * 60 * 1000 + 1);

      const result = await cache.getCountries(Background);
      expect(result).toBeNull();
    });

    it("当缓存的数据结构与 Zod Schema 不匹配时，应该返回 null 并清除缓存", async () => {
      store.setRawEntry(cacheKey, {
        data: [{ name: "China" }],
        expiry: Date.now() + 10000,
      });

      const result = await cache.getCountries(Background);
      expect(result).toBeNull();
    });

    it("当缓存中的记录不是合法的信封结构时，应该返回 null 且不崩溃", async () => {
      store.setRawEntry(cacheKey, { unexpected: "shape" });

      const result = await cache.getCountries(Background);
      expect(result).toBeNull();
    });
  });

  describe("channels 缓存", () => {
    it("当没有缓存时，应该返回 null", async () => {
      const result = await cache.getChannels(Background, "CN");
      expect(result).toBeNull();
    });

    it("当成功缓存且未过期时，应该能够正确读取缓存数据", async () => {
      await cache.setChannels(Background, "CN", mockChannels);
      const result = await cache.getChannels(Background, "CN");
      expect(result).toEqual(mockChannels);
    });

    it("不同的国家代码应该隔离缓存，且不区分大小写", async () => {
      await cache.setChannels(Background, "CN", mockChannels);
      const result = await cache.getChannels(Background, "JP");
      expect(result).toBeNull();
      expect(await cache.getChannels(Background, "cn")).toEqual(mockChannels);
    });

    it("当缓存已过期（超过12小时）时，应该返回 null 并清除缓存", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const now = Date.now();
      vi.setSystemTime(now);

      await cache.setChannels(Background, "CN", mockChannels);
      vi.setSystemTime(now + 12 * 60 * 60 * 1000 + 1);

      const result = await cache.getChannels(Background, "CN");
      expect(result).toBeNull();
    });

    it("当缓存数据格式不匹配时，应该返回 null 并清除缓存", async () => {
      const cacheKey = "iptv:channels:cn";
      store.setRawEntry(cacheKey, {
        data: [{ name: "Missing URL" }],
        expiry: Date.now() + 10000,
      });

      const result = await cache.getChannels(Background, "CN");
      expect(result).toBeNull();
    });
  });
});
