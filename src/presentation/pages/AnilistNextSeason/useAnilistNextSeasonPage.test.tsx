import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { NextSeasonData } from "@/domain/anime/AnimeSchemas";
import { resetAppStores } from "@/test/store-reset";
import type { UseAnilistNextSeasonPageDeps } from "./useAnilistNextSeasonPage";
import { useAnilistNextSeasonPage } from "./useAnilistNextSeasonPage";

const mockData: NextSeasonData = [
  {
    month: 10,
    label: "10月",
    items: [
      {
        id: 1,
        name: "Test Anime",
        image: "http://example.com/1.jpg",
        rating: 8,
      },
    ],
  },
];

const makeDeps = (
  overrides: Partial<UseAnilistNextSeasonPageDeps> = {},
): UseAnilistNextSeasonPageDeps => ({
  getAnilistNextSeasonUseCase: {
    execute: vi.fn().mockResolvedValue({
      info: { year: 2026, season: "秋", months: [10, 11, 12] },
      data: mockData,
    }),
  },
  ...overrides,
});

const lastNavigation: {
  current: { pathname: string; state: unknown } | null;
} = { current: null };
const LocationTracker = () => {
  lastNavigation.current = useLocation();
  return null;
};

const RouterWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <LocationTracker />
      {children}
    </MemoryRouter>
  );
};

const renderUseAnilistNextSeasonPage = (deps: UseAnilistNextSeasonPageDeps) => {
  return renderHook(() => useAnilistNextSeasonPage(deps), {
    wrapper: RouterWrapper,
  });
};

describe("useAnilistNextSeasonPage Anilist 下季新番页面 hook", () => {
  beforeEach(() => {
    resetAppStores();
  });

  it("应该调用 getAnilistNextSeasonUseCase.execute 并返回数据", async () => {
    const deps = makeDeps();
    const { result } = renderUseAnilistNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it("请求失败时应该返回错误信息", async () => {
    const deps = makeDeps({
      getAnilistNextSeasonUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("API error")),
      },
    });

    const { result } = renderUseAnilistNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("handleAnimeClick 应该导航到 anilist subject 页面", async () => {
    const deps = makeDeps();
    const { result } = renderUseAnilistNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleAnimeClick({
        id: 123,
        name: "Test Anime",
        image: "http://example.com/cover.jpg",
        rating: 8,
      });
    });

    expect(lastNavigation.current?.pathname).toBe("/anilist/subject/123");
    expect(lastNavigation.current?.state).toEqual({
      name: "Test Anime",
      imageUrl: "http://example.com/cover.jpg",
    });
  });
});
