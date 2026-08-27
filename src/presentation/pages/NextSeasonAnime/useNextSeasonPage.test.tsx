import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { NextSeasonData } from "@/domain/anime/AnimeSchemas";
import { resetAppStores } from "@/test/store-reset";
import type { UseNextSeasonPageDeps } from "./useNextSeasonPage";
import { useNextSeasonPage } from "./useNextSeasonPage";

const mockData: NextSeasonData = [
  {
    month: 10,
    label: "10月",
    items: [
      { id: 1, name: "测试动漫", image: "http://example.com/1.jpg", rating: 8 },
    ],
  },
  {
    month: 11,
    label: "11月",
    items: [
      {
        id: 2,
        name: "测试动漫2",
        image: "http://example.com/2.jpg",
        rating: 9,
      },
    ],
  },
];

const makeDeps = (
  overrides: Partial<UseNextSeasonPageDeps> = {},
): UseNextSeasonPageDeps => ({
  getBangumiNextSeasonUseCase: {
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

const renderUseNextSeasonPage = (deps: UseNextSeasonPageDeps) => {
  return renderHook(() => useNextSeasonPage(deps), {
    wrapper: RouterWrapper,
  });
};

describe("useNextSeasonPage 下季新番页面 hook", () => {
  beforeEach(() => {
    resetAppStores();
  });

  it("应该调用 getBangumiNextSeasonUseCase.execute 并返回数据", async () => {
    const deps = makeDeps();
    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it("请求失败时应该返回错误信息", async () => {
    const deps = makeDeps({
      getBangumiNextSeasonUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("API error")),
      },
    });

    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("handleAnimeClick 应该导航到 subject 页面并传递名称与封面", async () => {
    const deps = makeDeps();
    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleAnimeClick({
        id: 123,
        name: "测试动漫",
        image: "http://example.com/cover.jpg",
        rating: 8,
      });
    });

    expect(lastNavigation.current?.pathname).toBe("/subject/123");
    expect(lastNavigation.current?.state).toEqual({
      name: "测试动漫",
      imageUrl: "http://example.com/cover.jpg",
    });
  });

  it("数据已缓存时应该不重复请求", async () => {
    const executeMock = vi.fn().mockResolvedValue({
      info: { year: 2026, season: "秋", months: [10, 11, 12] },
      data: mockData,
    });
    const deps = makeDeps({
      getBangumiNextSeasonUseCase: { execute: executeMock },
    });

    const { result, rerender } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    expect(executeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender();
    });

    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});
