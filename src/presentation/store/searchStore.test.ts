import { describe, expect, it } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { TORRENT_SEARCH_ENGINES } from "@/domain/torrent/TorrentEngines";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { DEFAULT_SEARCH_ENGINE, useSearchStore } from "./searchStore";

const mockResult: AiSearchResultItem = {
  title: NonEmptyStringSchema.parse("xxx 第1集"),
  link: NonEmptyStringSchema.parse("http://example.com/1"),
  pub_date: "2026-06-23",
  magnet: NonEmptyStringSchema.parse("magnet:?xt=urn:btih:TEST1"),
  description: "",
};

describe("搜索全局状态 store", () => {
  afterEach(() => {
    useSearchStore.getState().reset();
  });

  it("应该提供默认状态与默认常量", () => {
    expect(DEFAULT_SEARCH_ENGINE).toBe(TORRENT_SEARCH_ENGINES[0]);
    const state = useSearchStore.getState();
    expect(state.searchKeyword).toBe("");
    expect(state.searchEngine).toBe(DEFAULT_SEARCH_ENGINE);
    expect(state.searchResults).toEqual([]);
    expect(state.searchHasSearched).toBe(false);
    expect(state.collapsedGroups).toEqual(new Set());
    expect(state.groups).toEqual([]);
  });

  it("应该能通过 setter 更新各个字段", () => {
    const state = useSearchStore.getState();
    state.setSearchKeyword("xxx");
    state.setSearchEngine("nyaa");
    state.setSearchResults([mockResult]);
    state.setSearchHasSearched(true);

    const updated = useSearchStore.getState();
    expect(updated.searchKeyword).toBe("xxx");
    expect(updated.searchEngine).toBe("nyaa");
    expect(updated.searchResults).toEqual([mockResult]);
    expect(updated.searchHasSearched).toBe(true);
  });

  it("应该能在设置搜索结果为分组计算 groups", () => {
    const state = useSearchStore.getState();
    state.setSearchResults([
      { ...mockResult, title: NonEmptyStringSchema.parse("[GroupB] 某番 01") },
      { ...mockResult, title: NonEmptyStringSchema.parse("[GroupA] 某番 01") },
      { ...mockResult, title: NonEmptyStringSchema.parse("[GroupA] 某番 02") },
      { ...mockResult, title: NonEmptyStringSchema.parse("无前缀 某番 01") },
    ]);

    const { groups } = useSearchStore.getState();
    expect(groups.map((g) => g.name)).toEqual(["GroupA", "GroupB", "未标注"]);
    expect(groups[0]).toMatchObject({
      startIndex: 0,
      items: [
        { ...mockResult, title: "[GroupA] 某番 01" },
        { ...mockResult, title: "[GroupA] 某番 02" },
      ],
    });
    expect(groups[1]).toMatchObject({ startIndex: 2 });
    expect(groups[2]).toMatchObject({
      startIndex: 3,
      items: [{ ...mockResult, title: "无前缀 某番 01" }],
    });
  });

  it("未标注组在输入靠前时仍应恒排最后", () => {
    const state = useSearchStore.getState();
    state.setSearchResults([
      { ...mockResult, title: NonEmptyStringSchema.parse("无前缀 某番 01") },
      { ...mockResult, title: NonEmptyStringSchema.parse("[GroupA] 某番 01") },
    ]);

    const { groups } = useSearchStore.getState();
    expect(groups.map((g) => g.name)).toEqual(["GroupA", "未标注"]);
  });

  it("应该能通过 toggleGroup 折叠或展开指定的组", () => {
    const state = useSearchStore.getState();
    state.toggleGroup("字幕组");
    expect(useSearchStore.getState().collapsedGroups).toEqual(
      new Set(["字幕组"]),
    );
    state.toggleGroup("ANi");
    expect(useSearchStore.getState().collapsedGroups).toEqual(
      new Set(["字幕组", "ANi"]),
    );
    state.toggleGroup("字幕组");
    expect(useSearchStore.getState().collapsedGroups).toEqual(new Set(["ANi"]));
  });

  it("应该能通过 collapseAllGroups 折叠所有组，expandAllGroups 全部展开", () => {
    useSearchStore.getState().collapseAllGroups(["字幕组", "ANi"]);
    expect(useSearchStore.getState().collapsedGroups).toEqual(
      new Set(["字幕组", "ANi"]),
    );
    useSearchStore.getState().expandAllGroups();
    expect(useSearchStore.getState().collapsedGroups).toEqual(new Set());
  });

  it("应该能通过 reset 恢复初始状态", () => {
    const state = useSearchStore.getState();
    state.setSearchKeyword("xxx");
    state.setSearchResults([mockResult]);
    state.collapseAllGroups(["字幕组"]);
    state.reset();
    expect(useSearchStore.getState()).toMatchObject({
      searchKeyword: "",
      searchEngine: DEFAULT_SEARCH_ENGINE,
      searchResults: [],
      searchHasSearched: false,
      collapsedGroups: new Set(),
      groups: [],
    });
  });
});
