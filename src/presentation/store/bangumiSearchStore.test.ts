import { describe, expect, it } from "vitest";
import { useBangumiSearchStore } from "./bangumiSearchStore";

describe("动漫搜索全局状态 store", () => {
  afterEach(() => {
    useBangumiSearchStore.getState().reset();
  });

  it("应该提供默认状态", () => {
    const state = useBangumiSearchStore.getState();
    expect(state.keyword).toBe("");
    expect(state.searchedKeyword).toBe("");
    expect(state.results).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.hasSearched).toBe(false);
  });

  it("应该能通过 setKeyword 更新关键词", () => {
    useBangumiSearchStore.getState().setKeyword("柯南");
    expect(useBangumiSearchStore.getState().keyword).toBe("柯南");
  });

  it("应该能通过 setSearchedKeyword 更新实际搜索关键词", () => {
    useBangumiSearchStore.getState().setSearchedKeyword("柯南");
    expect(useBangumiSearchStore.getState().searchedKeyword).toBe("柯南");
  });

  it("应该能通过 setResults 更新搜索结果", () => {
    const results = [
      {
        id: 1,
        name: "间谍过家家",
        summary: "",
        image: "",
        rating: 0,
        date: null,
        eps: null,
        platform: null,
      },
    ];
    useBangumiSearchStore.getState().setResults(results);
    expect(useBangumiSearchStore.getState().results).toEqual(results);
  });

  it("应该能通过 appendResults 追加搜索结果", () => {
    const first = {
      id: 1,
      name: "间谍过家家",
      summary: "",
      image: "",
      rating: 0,
      date: null,
      eps: null,
      platform: null,
    };
    const second = { ...first, id: 2 };
    useBangumiSearchStore.getState().setResults([first]);
    useBangumiSearchStore.getState().appendResults([second]);
    expect(useBangumiSearchStore.getState().results).toEqual([first, second]);
  });

  it("应该能通过 setTotal 更新总数", () => {
    useBangumiSearchStore.getState().setTotal(42);
    expect(useBangumiSearchStore.getState().total).toBe(42);
  });

  it("应该能通过 setHasSearched 更新搜索标记", () => {
    useBangumiSearchStore.getState().setHasSearched(true);
    expect(useBangumiSearchStore.getState().hasSearched).toBe(true);
  });

  it("应该能通过 reset 恢复初始状态", () => {
    useBangumiSearchStore.getState().setKeyword("柯南");
    useBangumiSearchStore.getState().setSearchedKeyword("柯南");
    useBangumiSearchStore.getState().setTotal(42);
    useBangumiSearchStore.getState().setHasSearched(true);
    useBangumiSearchStore.getState().reset();
    expect(useBangumiSearchStore.getState()).toMatchObject({
      keyword: "",
      searchedKeyword: "",
      results: [],
      total: 0,
      hasSearched: false,
    });
  });
});
