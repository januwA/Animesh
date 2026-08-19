import { renderHook, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
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

const RouterWrapper = ({ children }: { children: React.ReactNode }) => {
  const router = createMemoryRouter([{ path: "/", element: children }]);
  return <RouterProvider router={router} />;
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
});
