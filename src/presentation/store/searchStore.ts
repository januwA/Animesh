import { create } from "zustand";
import {
  TORRENT_SEARCH_ENGINES,
  type TorrentSearchEngine,
} from "@/domain/torrent/TorrentEngines";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";

export const DEFAULT_SEARCH_ENGINE: TorrentSearchEngine =
  TORRENT_SEARCH_ENGINES[0];

// 未在标题中显式标注字幕组前缀的结果归入该组，并恒排最末
const UNKNOWN_GROUP_LABEL = "未标注";

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
function groupTorrentResults(
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
  searchKeyword: string;
  searchEngine: TorrentSearchEngine;
  searchResults: AiSearchResultItem[];
  searchHasSearched: boolean;
  collapsedGroups: Set<string>;
  groups: TorrentResultGroup[];
  setSearchKeyword: (val: string) => void;
  setSearchEngine: (val: TorrentSearchEngine) => void;
  setSearchResults: (val: AiSearchResultItem[]) => void;
  setSearchHasSearched: (val: boolean) => void;
  toggleGroup: (name: string) => void;
  collapseAllGroups: (groupNames: string[]) => void;
  expandAllGroups: () => void;
  reset: () => void;
}

const initialState = {
  searchKeyword: "",
  searchEngine: DEFAULT_SEARCH_ENGINE,
  searchResults: [] as AiSearchResultItem[],
  searchHasSearched: false,
  collapsedGroups: new Set<string>(),
  groups: [] as TorrentResultGroup[],
};

export const useSearchStore = create<SearchStoreState>()((set) => ({
  ...initialState,
  setSearchKeyword: (val) => set({ searchKeyword: val }),
  setSearchEngine: (val) => set({ searchEngine: val }),
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
  reset: () => set(initialState),
}));
