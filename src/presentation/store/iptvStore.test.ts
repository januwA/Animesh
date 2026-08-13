import { describe, expect, it } from "vitest";
import {
  DEFAULT_IPTV_CATEGORY,
  DEFAULT_IPTV_COUNTRY,
  useIptvStore,
} from "./iptvStore";

const mockCountry = { name: "日本", code: "JP", flag: "🇯🇵" };
const mockChannel = {
  tvgId: "nhk",
  name: "NHK",
  logo: null,
  category: "综合",
  url: "http://example.com/nhk.m3u8",
};

describe("IPTV 全局状态 store", () => {
  afterEach(() => {
    useIptvStore.getState().reset();
  });

  it("应该提供默认状态与默认常量", () => {
    expect(DEFAULT_IPTV_COUNTRY).toBe("CN");
    expect(DEFAULT_IPTV_CATEGORY).toBe("all");
    const state = useIptvStore.getState();
    expect(state.iptvCountries).toEqual([]);
    expect(state.iptvSelectedCountry).toBe(DEFAULT_IPTV_COUNTRY);
    expect(state.iptvChannels).toEqual([]);
    expect(state.iptvChannelsCountry).toBeNull();
    expect(state.iptvSelectedCategory).toBe(DEFAULT_IPTV_CATEGORY);
    expect(state.iptvKeyword).toBe("");
  });

  it("应该能通过 setter 更新各个字段", () => {
    const state = useIptvStore.getState();
    state.setIptvCountries([mockCountry]);
    state.setIptvSelectedCountry("JP");
    state.setIptvChannels([mockChannel]);
    state.setIptvChannelsCountry("JP");
    state.setIptvSelectedCategory("综合");
    state.setIptvKeyword("nhk");

    const updated = useIptvStore.getState();
    expect(updated.iptvCountries).toEqual([mockCountry]);
    expect(updated.iptvSelectedCountry).toBe("JP");
    expect(updated.iptvChannels).toEqual([mockChannel]);
    expect(updated.iptvChannelsCountry).toBe("JP");
    expect(updated.iptvSelectedCategory).toBe("综合");
    expect(updated.iptvKeyword).toBe("nhk");
  });

  it("应该能通过 reset 恢复初始状态", () => {
    const state = useIptvStore.getState();
    state.setIptvCountries([mockCountry]);
    state.setIptvChannels([mockChannel]);
    state.reset();
    expect(useIptvStore.getState()).toMatchObject({
      iptvCountries: [],
      iptvSelectedCountry: DEFAULT_IPTV_COUNTRY,
      iptvChannels: [],
      iptvChannelsCountry: null,
      iptvSelectedCategory: DEFAULT_IPTV_CATEGORY,
      iptvKeyword: "",
    });
  });
});
