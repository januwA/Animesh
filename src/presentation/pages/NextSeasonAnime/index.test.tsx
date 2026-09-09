import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIContext } from "@/di/DIContext";
import NextSeasonAnime from "./index";

vi.mock(import("./useNextSeasonPage"), () => ({
  useNextSeasonPage: vi.fn(),
}));
vi.mock(import("./MonthCalendar"), () => ({
  MonthCalendar: vi.fn(
    ({
      activeMonth,
      onActiveMonthChange,
    }: {
      activeMonth: number;
      onActiveMonthChange: (month: number) => void;
    }) => (
      <div>
        <span data-testid="active-month">{String(activeMonth)}</span>
        <button type="button" onClick={() => onActiveMonthChange(8)}>
          select-month-8
        </button>
      </div>
    ),
  ),
}));

import { useNextSeasonPage } from "./useNextSeasonPage";

const mockContainer = {
  getBangumiNextSeasonUseCase: {},
  getAnilistNextSeasonUseCase: {},
} as unknown as DIContainer;

const mockPage = (
  overrides: Partial<ReturnType<typeof useNextSeasonPage>> = {},
) => {
  vi.mocked(useNextSeasonPage).mockReturnValue({
    tabs: [
      { month: 7, label: "7月" },
      { month: 8, label: "8月" },
      { month: 9, label: "9月" },
    ],
    activeMonth: 7,
    setActiveMonth: vi.fn(),
    items: [],
    hasNextPage: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    hasMore: false,
    loadingMore: false,
    loadMore: vi.fn(),
    handleAnimeClick: vi.fn(),
    ...overrides,
  });
};

const locationRef: { current: { search: string } | null } = { current: null };
const LocationTracker = () => {
  locationRef.current = useLocation();
  return null;
};

function renderPage(initialEntry: string) {
  return render(
    <DIContext value={mockContainer}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationTracker />
        <Routes>
          <Route path="/anime/next-season" element={<NextSeasonAnime />} />
        </Routes>
      </MemoryRouter>
    </DIContext>,
  );
}

describe("NextSeasonAnime 页面", () => {
  it("缺少 platform 参数时应渲染参数错误视图", () => {
    renderPage("/anime/next-season");
    expect(screen.getByText("无效的新番参数")).toBeInTheDocument();
  });

  it("month 参数超出 1-12 范围时应渲染参数错误视图", () => {
    renderPage("/anime/next-season?platform=bangumi&month=13");
    expect(screen.getByText("无效的新番参数")).toBeInTheDocument();
    expect(screen.getByText("无效的月份参数")).toBeInTheDocument();
  });

  it("month 参数非数字时应渲染参数错误视图", () => {
    renderPage("/anime/next-season?platform=bangumi&month=abc");
    expect(screen.getByText("无效的新番参数")).toBeInTheDocument();
  });

  it("month 参数应透传给页面 hook", () => {
    mockPage({ activeMonth: 8 });
    renderPage("/anime/next-season?platform=bangumi&month=8");
    expect(useNextSeasonPage).toHaveBeenCalledWith(
      expect.objectContaining({
        getNextSeasonUseCase: mockContainer.getBangumiNextSeasonUseCase,
      }),
      expect.any(Function),
      8,
    );
    expect(screen.getByTestId("active-month")).toHaveTextContent("8");
  });

  it("切换选中月份时应调用 hook 的 setActiveMonth", async () => {
    const user = userEvent.setup();
    const setActiveMonth = vi.fn();
    mockPage({ setActiveMonth });
    renderPage("/anime/next-season?platform=bangumi");

    await user.click(screen.getByText("select-month-8"));

    expect(setActiveMonth).toHaveBeenCalledWith(8);
  });
});
