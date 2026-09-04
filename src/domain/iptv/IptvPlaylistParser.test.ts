import { describe, expect, it } from "vitest";
import { parseM3u } from "./IptvPlaylistParser";

describe("parseM3u", () => {
  it("应该解析带 tvg-id、tvg-logo 和 group-title 的频道列表", () => {
    const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="CCTV1.cn@HD" tvg-logo="https://i.imgur.com/TpA3cUl.png" group-title="General",CCTV-1 (1080p)
http://69.30.245.50/live/cctv1.m3u8
#EXTINF:-1 tvg-id="ABNChina.us@SD" tvg-logo="https://i.imgur.com/zagVLQH.png" group-title="Religious",ABN China (720p)
https://mediaserver.abnvideos.com/streams/abnchina.m3u8`;

    const channels = parseM3u(m3u);

    expect(channels).toHaveLength(2);
    expect(channels[0]).toEqual({
      tvgId: "CCTV1.cn@HD",
      name: "CCTV-1 (1080p)",
      logo: "https://i.imgur.com/TpA3cUl.png",
      category: "General",
      url: "http://69.30.245.50/live/cctv1.m3u8",
    });
    expect(channels[1]).toEqual({
      tvgId: "ABNChina.us@SD",
      name: "ABN China (720p)",
      logo: "https://i.imgur.com/zagVLQH.png",
      category: "Religious",
      url: "https://mediaserver.abnvideos.com/streams/abnchina.m3u8",
    });
  });

  it("应该跳过 #EXTVLCOPT 配置行并正确关联下一个流地址", () => {
    const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="CCTV2.cn@SD" group-title="Business",CCTV-2 (720p)
#EXTVLCOPT:http-user-agent=Mozilla/5.0
#EXTVLCOPT:http-referrer=https://example.com/
http://74.91.26.218:82/live/cctv2hd.m3u8`;

    const channels = parseM3u(m3u);

    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({
      name: "CCTV-2 (720p)",
      url: "http://74.91.26.218:82/live/cctv2hd.m3u8",
    });
  });

  it("应该处理没有属性且时长非 -1 的频道条目", () => {
    const m3u =
      "#EXTM3U\n#EXTINF:0,Basic Channel\nhttps://example.com/basic.m3u8";

    const channels = parseM3u(m3u);

    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({
      tvgId: null,
      name: "Basic Channel",
      logo: null,
      category: null,
      url: "https://example.com/basic.m3u8",
    });
  });

  it("应该处理 CRLF 行尾和多余空行", () => {
    const m3u =
      '#EXTM3U\r\n\r\n#EXTINF:-1 group-title="News",News Channel\r\nhttps://example.com/news.m3u8\r\n';

    const channels = parseM3u(m3u);

    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({
      name: "News Channel",
      category: "News",
      url: "https://example.com/news.m3u8",
    });
  });

  it("应该处理 EXTINF 行中时长不是整数（正则不匹配）的情况", () => {
    const m3u =
      "#EXTM3U\n#EXTINF:abc,Non-Integer Duration\nhttps://example.com/float.m3u8";

    const channels = parseM3u(m3u);

    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({
      name: "Non-Integer Duration",
      url: "https://example.com/float.m3u8",
    });
  });

  it("应该处理 EXTINF 行中没有逗号分隔的频道名称", () => {
    const m3u =
      "#EXTM3U\n#EXTINF:-1 No Comma Channel\nhttps://example.com/nocomma.m3u8";

    const channels = parseM3u(m3u);

    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({
      name: "No Comma Channel",
      url: "https://example.com/nocomma.m3u8",
    });
  });

  it("应该忽略没有对应 EXTINF 的裸 URL 行", () => {
    const m3u =
      "#EXTM3U\nhttps://example.com/orphan.m3u8\n#EXTINF:-1,Valid Channel\nhttps://example.com/valid.m3u8";

    const channels = parseM3u(m3u);

    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({
      name: "Valid Channel",
      url: "https://example.com/valid.m3u8",
    });
  });

  it("当输入为空或没有频道条目时应返回空数组", () => {
    expect(parseM3u("")).toEqual([]);
    expect(parseM3u("#EXTM3U\n#EXTINF:-1,No URL\n")).toEqual([]);
  });
});
