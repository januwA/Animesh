import { describe, expect, it } from "vitest";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { useAnilistSearchStore } from "./anilistSearchStore";

function makeSubject(overrides: Partial<AnimeSubject> = {}): AnimeSubject {
  return {
    id: 1,
    name: "间谍过家家",
    summary: "简介",
    image: "https://img.example/l.jpg",
    rating: 8.5,
    date: "2022-04-09",
    eps: 12,
    platform: "TV",
    ...overrides,
  };
}

describe("useAnilistSearchStore Anilist 搜索状态管理", () => {
  it("初始状态", () => {
    const state = useAnilistSearchStore.getState();
    expect(state.keyword).toBe("");
    expect(state.searchedKeyword).toBe("");
    expect(state.results).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.hasSearched).toBe(false);
  });

  it("setKeyword 设置关键词", () => {
    useAnilistSearchStore.getState().setKeyword("柯南");
    expect(useAnilistSearchStore.getState().keyword).toBe("柯南");
  });

  it("setSearchedKeyword 设置已搜索关键词", () => {
    useAnilistSearchStore.getState().setSearchedKeyword("柯南");
    expect(useAnilistSearchStore.getState().searchedKeyword).toBe("柯南");
  });

  it("setResults 设置搜索结果", () => {
    const subjects = [makeSubject({ id: 1 }), makeSubject({ id: 2 })];
    useAnilistSearchStore.getState().setResults(subjects);
    expect(useAnilistSearchStore.getState().results).toEqual(subjects);
  });

  it("appendResults 追加搜索结果", () => {
    useAnilistSearchStore.getState().setResults([makeSubject({ id: 1 })]);
    useAnilistSearchStore.getState().appendResults([makeSubject({ id: 2 })]);
    expect(useAnilistSearchStore.getState().results).toEqual([
      makeSubject({ id: 1 }),
      makeSubject({ id: 2 }),
    ]);
  });

  it("setTotal 设置总数", () => {
    useAnilistSearchStore.getState().setTotal(100);
    expect(useAnilistSearchStore.getState().total).toBe(100);
  });

  it("setHasSearched 设置已搜索状态", () => {
    useAnilistSearchStore.getState().setHasSearched(true);
    expect(useAnilistSearchStore.getState().hasSearched).toBe(true);
  });

  it("reset 重置到初始状态", () => {
    useAnilistSearchStore.getState().setKeyword("柯南");
    useAnilistSearchStore.getState().setResults([makeSubject()]);
    useAnilistSearchStore.getState().setTotal(100);
    useAnilistSearchStore.getState().setHasSearched(true);

    useAnilistSearchStore.getState().reset();

    const state = useAnilistSearchStore.getState();
    expect(state.keyword).toBe("");
    expect(state.searchedKeyword).toBe("");
    expect(state.results).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.hasSearched).toBe(false);
  });
});
