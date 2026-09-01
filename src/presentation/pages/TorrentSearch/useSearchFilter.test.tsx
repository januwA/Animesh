import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import type { SearchFilter } from "@/presentation/store/searchStore";
import { filterResults } from "./useSearchFilter";

function makeItem(title: string, pubDate: string): SearchResultItem {
  return {
    title: NonEmptyStringSchema.parse(title),
    link: NonEmptyStringSchema.parse("http://example.com/1"),
    pub_date: pubDate,
    magnet: NonEmptyStringSchema.parse("magnet:?xt=urn:btih:TEST1"),
    description: "",
  };
}

const DEFAULT_FILTER: SearchFilter = { pubDatePreset: "all" };

describe("filterResults 过滤逻辑", () => {
  it("预设 all 不过滤", () => {
    const items = [makeItem("某番 01", "2020-01-01")];
    expect(filterResults(items, DEFAULT_FILTER)).toEqual(items);
  });

  describe("pubDatePreset 时间过滤", () => {
    const NOW = new Date("2026-07-01T12:00:00Z").getTime();

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("预设 24h 仅保留 24 小时内的结果", () => {
      const items = [
        makeItem("某番 01", "2026-07-01"),
        makeItem("某番 02", "2026-06-30"),
        makeItem("某番 03", "2026-06-20"),
      ];
      const result = filterResults(items, { pubDatePreset: "24h" });
      expect(result).toHaveLength(1);
      expect(result[0].title).toContain("01");
    });

    it("预设 week 仅保留一周内的结果", () => {
      const items = [
        makeItem("某番 01", "2026-07-01"),
        makeItem("某番 02", "2026-06-28"),
        makeItem("某番 03", "2026-06-20"),
      ];
      const result = filterResults(items, { pubDatePreset: "week" });
      expect(result).toHaveLength(2);
    });

    it("预设 month 仅保留 30 天内的结果", () => {
      const items = [
        makeItem("某番 01", "2026-07-01"),
        makeItem("某番 02", "2026-06-15"),
        makeItem("某番 03", "2026-05-30"),
      ];
      const result = filterResults(items, { pubDatePreset: "month" });
      expect(result).toHaveLength(2);
    });

    it("无效日期字符串的结果被过滤掉", () => {
      const items = [makeItem("某番 01", "invalid-date")];
      const result = filterResults(items, { pubDatePreset: "24h" });
      expect(result).toHaveLength(0);
    });
  });
});
