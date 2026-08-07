import { describe, expect, it } from "vitest";
import { getTrackerUrl, parseTrackers } from "./TrackerSettings";

describe("领域层 TrackerSettings 规则", () => {
  describe("getTrackerUrl 获取同步源 URL", () => {
    it("应该根据指定的 Preset 返回 GitHub CDN URL", () => {
      const url = getTrackerUrl("best");
      expect(url).toBe(
        "https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt",
      );
    });

    it("对于自定义的情况，应该原样返回 customUrl", () => {
      const url = getTrackerUrl("custom", "https://example.com/trackers.txt");
      expect(url).toBe("https://example.com/trackers.txt");
    });

    it("自定义且无URL时应该返回空串", () => {
      const url = getTrackerUrl("custom");
      expect(url).toBe("");
    });
  });

  describe("parseTrackers 解析文本", () => {
    it("应该过滤掉空行、注释行与不符合 scheme 的无效行", () => {
      const rawText = `
				udp://tracker.opentrackr.org:1337/announce

				# 这是注释内容
				http://tracker.gbitt.info:80/announce
				invalid-tracker-url
			`;
      const result = parseTrackers(rawText);
      expect(result).toEqual([
        "udp://tracker.opentrackr.org:1337/announce",
        "http://tracker.gbitt.info:80/announce",
      ]);
    });
  });
});
