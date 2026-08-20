import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { BangumiCalendarItem } from "@/domain/bangumi/BangumiSchemas";
import { resetAppStores } from "@/test/store-reset";
import type { UseCalendarPageDeps } from "./useCalendarPage";
import { useCalendarPage } from "./useCalendarPage";

const makeDeps = (
  overrides: Partial<UseCalendarPageDeps> = {},
): UseCalendarPageDeps => ({
  getBangumiCalendarUseCase: {
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

const renderUseCalendarPage = (deps: UseCalendarPageDeps) => {
  return renderHook(() => useCalendarPage(deps), {
    wrapper: RouterWrapper,
  });
};

describe("useCalendarPage 日历页面 hook", () => {
  beforeEach(() => {
    resetAppStores();
  });

  it("应该调用 getBangumiCalendarUseCase.execute 并返回日历数据", async () => {
    const mockCalendar = [
      {
        weekday: { id: 1, en: "Monday", cn: "星期一", ja: "月曜日" },
        items: [],
      },
    ];
    const deps = makeDeps({
      getBangumiCalendarUseCase: {
        execute: vi.fn().mockResolvedValue(mockCalendar),
      },
    });

    const { result } = renderUseCalendarPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.calendar).toEqual(mockCalendar);
    expect(result.current.error).toBeNull();
  });

  it("请求失败时应该返回错误信息", async () => {
    const deps = makeDeps({
      getBangumiCalendarUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("API error")),
      },
    });

    const { result } = renderUseCalendarPage(deps);

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("handleAnimeClick 应该导航到 subject 页面并传递名称与封面", async () => {
    const deps = makeDeps();
    const { result } = renderUseCalendarPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const mockItem = {
      id: 123,
      url: "http://example.com/123",
      name: "测试动漫",
      air_date: "2026-01-01",
      air_weekday: 1,
      image: "http://example.com/cover.jpg",
    };

    act(() => {
      result.current.handleAnimeClick(mockItem as any);
    });

    expect(lastNavigation.current?.pathname).toBe("/subject/123");
    expect(lastNavigation.current?.state).toEqual({
      name: "测试动漫",
      imageUrl: "http://example.com/cover.jpg",
    });
  });

  it("handleAnimeClick 无中文名时应该使用原始名称导航", async () => {
    const deps = makeDeps();
    const { result } = renderUseCalendarPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const mockItem: BangumiCalendarItem = {
      id: 456,
      url: "http://example.com/456",
      name: "Raw Anime",
      air_weekday: 2,
      image: "",
      rating: 0,
    };

    act(() => {
      result.current.handleAnimeClick(mockItem as any);
    });

    expect(lastNavigation.current?.pathname).toBe("/subject/456");
    expect(lastNavigation.current?.state).toEqual({
      name: "Raw Anime",
      imageUrl: "",
    });
  });

  it("日历数据已缓存时应该不重复请求", async () => {
    const mockCalendar = [
      {
        weekday: { id: 1, en: "Monday", cn: "星期一", ja: "月曜日" },
        items: [],
      },
    ];
    const executeMock = vi.fn().mockResolvedValue(mockCalendar);
    const deps = makeDeps({
      getBangumiCalendarUseCase: { execute: executeMock },
    });

    const { result, rerender } = renderUseCalendarPage(deps);

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
