import { create } from "zustand";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";

// 未在标题中显式标注字幕组前缀的结果归入该组，并恒排最末
const UNKNOWN_GROUP_LABEL = "未标注";

export interface SearchFilter {
  pubDatePreset: "all" | "24h" | "week" | "month";
}

export const DEFAULT_FILTER: SearchFilter = {
  pubDatePreset: "all",
};

export interface TorrentResultGroup {
  name: string;
  startIndex: number;
  items: AiSearchResultItem[];
}

// 提取标题开头的发布组/字幕组名称（支持 [..] 与 【..】），无前缀返回 null
function extractReleaseGroup(title: string): string | null {
  const match = /^(?:\[([^\]]+)\]|【([^】]+)】)\s*/.exec(title);
  return match ? (match[1] ?? match[2]) : null;
}

// 将搜索结果按字幕组分组：数量降序、同数量保持首现顺序、未标注组恒排最后；组内保持原相对顺序
export function groupTorrentResults(
  results: AiSearchResultItem[],
): TorrentResultGroup[] {
  const groups = new Map<string, AiSearchResultItem[]>();
  for (const item of results) {
    const name = extractReleaseGroup(item.title) ?? UNKNOWN_GROUP_LABEL;
    const list = groups.get(name);
    if (list) {
      list.push(item);
    } else {
      groups.set(name, [item]);
    }
  }

  const sortedEntries = Array.from(groups.entries()).sort(
    ([nameA, itemsA], [nameB, itemsB]) => {
      if (nameA === UNKNOWN_GROUP_LABEL) return 1;
      if (nameB === UNKNOWN_GROUP_LABEL) return -1;
      return itemsB.length - itemsA.length;
    },
  );

  let startIndex = 0;
  return sortedEntries.map(([name, items]) => {
    const group = { name, startIndex, items };
    startIndex += items.length;
    return group;
  });
}

interface SearchStoreState {
  searchResults: AiSearchResultItem[];
  searchHasSearched: boolean;
  collapsedGroups: Set<string>;
  groups: TorrentResultGroup[];
  filter: SearchFilter;
  setSearchResults: (val: AiSearchResultItem[]) => void;
  setSearchHasSearched: (val: boolean) => void;
  toggleGroup: (name: string) => void;
  collapseAllGroups: (groupNames: string[]) => void;
  expandAllGroups: () => void;
  setFilter: (filter: SearchFilter) => void;
  resetFilter: () => void;
  reset: () => void;
}

const initialState = {
  searchResults: [] as AiSearchResultItem[],
  searchHasSearched: false,
  collapsedGroups: new Set<string>(),
  groups: [] as TorrentResultGroup[],
  filter: DEFAULT_FILTER,
};

export const useSearchStore = create<SearchStoreState>()((set) => ({
  ...initialState,
  setSearchResults: (val) =>
    set({ searchResults: val, groups: groupTorrentResults(val) }),
  setSearchHasSearched: (val) => set({ searchHasSearched: val }),
  toggleGroup: (name) =>
    set((state) => {
      const next = new Set(state.collapsedGroups);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return { collapsedGroups: next };
    }),
  collapseAllGroups: (groupNames) =>
    set({ collapsedGroups: new Set(groupNames) }),
  expandAllGroups: () => set({ collapsedGroups: new Set() }),
  setFilter: (filter) => set({ filter }),
  resetFilter: () => set({ filter: DEFAULT_FILTER }),
  reset: () => set(initialState),
}));
