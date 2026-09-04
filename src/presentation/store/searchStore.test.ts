import { describe, expect, it } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { useSearchStore } from "./searchStore";

const mockResult: SearchResultItem = {
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

  it("应该提供默认状态", () => {
    const state = useSearchStore.getState();
    expect(state.searchResults).toEqual(null);
    expect(state.collapsedGroups).toEqual(new Set());
    expect(state.groups).toEqual([]);
  });

  it("应该能通过 setter 更新各个字段", () => {
    const state = useSearchStore.getState();
    state.setSearchResults([mockResult]);

    const updated = useSearchStore.getState();
    expect(updated.searchResults).toEqual([mockResult]);
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
    state.setSearchResults([mockResult]);
    state.collapseAllGroups(["字幕组"]);
    state.reset();
    expect(useSearchStore.getState()).toMatchObject({
      searchResults: null,
      collapsedGroups: new Set(),
      groups: [],
    });
  });

  it("应该能通过 setFilter 更新过滤条件", () => {
    const state = useSearchStore.getState();
    state.setFilter({
      keyword: "xxx",
      searchEngines: ["dmhy"],
      pubDatePreset: "week",
    });
    expect(useSearchStore.getState().filter).toEqual({
      keyword: "xxx",
      searchEngines: ["dmhy"],
      pubDatePreset: "week",
    });

    state.setFilter({
      keyword: "yyy",
      searchEngines: ["nyaa"],
      pubDatePreset: "24h",
    });
    expect(useSearchStore.getState().filter).toEqual({
      keyword: "yyy",
      searchEngines: ["nyaa"],
      pubDatePreset: "24h",
    });
  });

  it("应该能通过 resetFilter 恢复默认过滤条件", () => {
    const state = useSearchStore.getState();
    state.setFilter({
      keyword: "xxx",
      searchEngines: ["dmhy"],
      pubDatePreset: "month",
    });
    expect(useSearchStore.getState().filter).toEqual({
      keyword: "xxx",
      searchEngines: ["dmhy"],
      pubDatePreset: "month",
    });

    state.resetFilter();
    expect(useSearchStore.getState().filter).toEqual({
      keyword: "",
      searchEngines: ["anibt"],
      pubDatePreset: "all",
    });
  });

  it("应该能通过 setKeyword 更新关键词", () => {
    const state = useSearchStore.getState();
    state.setKeyword("柯南");
    expect(useSearchStore.getState().filter.keyword).toBe("柯南");

    state.setKeyword("海贼王");
    expect(useSearchStore.getState().filter.keyword).toBe("海贼王");
  });

  it("应该能通过 setSearchEngines 更新搜索引擎列表", () => {
    const state = useSearchStore.getState();
    state.setSearchEngines(["dmhy", "nyaa"]);
    expect(useSearchStore.getState().filter.searchEngines).toEqual([
      "dmhy",
      "nyaa",
    ]);

    state.setSearchEngines(["mikan"]);
    expect(useSearchStore.getState().filter.searchEngines).toEqual(["mikan"]);
  });

  it("应该能通过 setPubDatePreset 更新发布日期预设", () => {
    const state = useSearchStore.getState();
    state.setPubDatePreset("week");
    expect(useSearchStore.getState().filter.pubDatePreset).toBe("week");

    state.setPubDatePreset("24h");
    expect(useSearchStore.getState().filter.pubDatePreset).toBe("24h");
  });

  it("setKeyword/setSearchEngines/setPubDatePreset 应只更新对应子字段", () => {
    const state = useSearchStore.getState();
    state.setFilter({
      keyword: "柯南",
      searchEngines: ["dmhy"],
      pubDatePreset: "week",
    });

    state.setKeyword("海贼王");
    expect(useSearchStore.getState().filter).toEqual({
      keyword: "海贼王",
      searchEngines: ["dmhy"],
      pubDatePreset: "week",
    });

    state.setSearchEngines(["nyaa"]);
    expect(useSearchStore.getState().filter).toEqual({
      keyword: "海贼王",
      searchEngines: ["nyaa"],
      pubDatePreset: "week",
    });

    state.setPubDatePreset("month");
    expect(useSearchStore.getState().filter).toEqual({
      keyword: "海贼王",
      searchEngines: ["nyaa"],
      pubDatePreset: "month",
    });
  });
});
