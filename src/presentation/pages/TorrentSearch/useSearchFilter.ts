import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";
import type { SearchFilter } from "@/presentation/store/searchStore";

const CUTOFF_MS: Record<"24h" | "week" | "month", number> = {
  "24h": 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

export function filterResults(
  results: AiSearchResultItem[],
  filter: SearchFilter,
): AiSearchResultItem[] {
  return results.filter((item) => {
    if (filter.pubDatePreset !== "all") {
      const cutoff = Date.now() - CUTOFF_MS[filter.pubDatePreset];
      const itemTime = new Date(item.pub_date).getTime();
      if (Number.isNaN(itemTime) || itemTime < cutoff) return false;
    }
    return true;
  });
}
