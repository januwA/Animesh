import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AnimeCalendarItem } from "@/domain/anime/AnimeSchemas";
import { resetAppStores } from "@/test/store-reset";
import type { UseAnilistCalendarPageDeps } from "./useAnilistCalendarPage";
import { useAnilistCalendarPage } from "./useAnilistCalendarPage";

const makeDeps = (
  overrides: Partial<UseAnilistCalendarPageDeps> = {},
): UseAnilistCalendarPageDeps => ({
  getAnilistCalendarUseCase: {
    execute: vi.fn().mockResolvedValue([]),
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

const renderUseAnilistCalendarPage = (deps: UseAnilistCalendarPageDeps) => {
  return renderHook(() => useAnilistCalendarPage(deps), {
    wrapper: RouterWrapper,
  });
};

describe("useAnilistCalendarPage Anilist 日历页面 hook", () => {
  beforeEach(() => {
    resetAppStores();
  });

  it("应该调用 getAnilistCalendarUseCase.execute 并返回日历数据", async () => {
    const mockCalendar = [
      {
        weekday: { id: 1 },
        items: [{ id: 1, name: "测试动漫", image: "", rating: 0 }],
      },
    ];
    const deps = makeDeps({
      getAnilistCalendarUseCase: {
        execute: vi.fn().mockResolvedValue(mockCalendar),
      },
    });

    const { result } = renderUseAnilistCalendarPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.calendar).toEqual(mockCalendar);
    expect(result.current.error).toBeNull();
  });

  it("请求失败时应该返回错误信息", async () => {
    const deps = makeDeps({
      getAnilistCalendarUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("API error")),
      },
    });

    const { result } = renderUseAnilistCalendarPage(deps);

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("handleAnimeClick 应该导航到 subject 页面并传递名称与封面", async () => {
    const deps = makeDeps();
    const { result } = renderUseAnilistCalendarPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const mockItem: AnimeCalendarItem = {
      id: 123,
      name: "测试动漫",
      image: "http://example.com/cover.jpg",
      rating: 0,
    };

    act(() => {
      result.current.handleAnimeClick(mockItem);
    });

    expect(lastNavigation.current?.pathname).toBe("/subject/123");
    expect(lastNavigation.current?.state).toEqual({
      name: "测试动漫",
      imageUrl: "http://example.com/cover.jpg",
    });
  });

  it("日历数据已缓存时应该不重复请求", async () => {
    const mockCalendar = [
      {
        weekday: { id: 1 },
        items: [{ id: 1, name: "测试动漫", image: "", rating: 0 }],
      },
    ];
    const executeMock = vi.fn().mockResolvedValue(mockCalendar);
    const deps = makeDeps({
      getAnilistCalendarUseCase: { execute: executeMock },
    });

    const { result, rerender } = renderUseAnilistCalendarPage(deps);

    await waitFor(() => {
      expect(result.current.calendar).toEqual(mockCalendar);
    });

    expect(executeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender();
    });

    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});
