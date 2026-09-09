import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIContext } from "@/di/DIContext";
import type { AnimeCalendarDay } from "@/domain/anime/AnimeSchemas";
import SubjectCalendar from "./index";

vi.mock(import("./useSubjectCalendarPage"), () => ({
  useSubjectCalendarPage: vi.fn(),
}));
vi.mock(import("./WeeklyCalendar"), () => ({
  WeeklyCalendar: vi.fn(
    ({
      calendarActiveDay,
      onActiveDayChange,
    }: {
      calendarActiveDay: number | null;
      onActiveDayChange: (dayId: number | null) => void;
    }) => (
      <div>
        <span data-testid="active-day">{String(calendarActiveDay)}</span>
        <button type="button" onClick={() => onActiveDayChange(3)}>
          select-day-3
        </button>
        <button type="button" onClick={() => onActiveDayChange(null)}>
          clear-day
        </button>
      </div>
    ),
  ),
}));

import { useSubjectCalendarPage } from "./useSubjectCalendarPage";

const mockCalendarDay = {
  weekday: { id: 1, en: "Monday", cn: "星期一", ja: "月曜日" },
  items: [],
} as unknown as AnimeCalendarDay;

const mockContainer = {
  getBangumiCalendarUseCase: {},
  getAnilistCalendarUseCase: {},
} as unknown as DIContainer;

function renderPage(initialEntry: string) {
  return render(
    <DIContext value={mockContainer}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/anime/calendar" element={<SubjectCalendar />} />
        </Routes>
      </MemoryRouter>
    </DIContext>,
  );
}

const mockPage = (
  overrides: Partial<ReturnType<typeof useSubjectCalendarPage>> = {},
) => {
  vi.mocked(useSubjectCalendarPage).mockReturnValue({
    calendar: [mockCalendarDay],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    handleAnimeClick: vi.fn(),
    ...overrides,
  });
};

describe("SubjectCalendar 页面", () => {
  it("缺少 platform 参数时应渲染参数错误视图", () => {
    renderPage("/anime/calendar");
    expect(screen.getByText("无效的日历参数")).toBeInTheDocument();
  });

  it("day 参数超出 1-7 范围时应渲染参数错误视图", () => {
    renderPage("/anime/calendar?platform=bangumi&day=9");
    expect(screen.getByText("无效的日历参数")).toBeInTheDocument();
    expect(screen.getByText("无效的星期参数")).toBeInTheDocument();
  });

  it("day 参数非数字时应渲染参数错误视图", () => {
    renderPage("/anime/calendar?platform=bangumi&day=abc");
    expect(screen.getByText("无效的日历参数")).toBeInTheDocument();
  });

  it("无 day 参数时应以 null 作为选中日", () => {
    mockPage();
    renderPage("/anime/calendar?platform=bangumi");
    expect(screen.getByTestId("active-day")).toHaveTextContent("null");
  });

  it("合法 day 参数时应以该值作为选中日", () => {
    mockPage();
    renderPage("/anime/calendar?platform=bangumi&day=5");
    expect(screen.getByTestId("active-day")).toHaveTextContent("5");
  });

  it("切换选中日时应写入 URL 查询参数", async () => {
    const user = userEvent.setup();
    mockPage();
    renderPage("/anime/calendar?platform=bangumi");

    await user.click(screen.getByText("select-day-3"));

    expect(screen.getByTestId("active-day")).toHaveTextContent("3");
    expect(useSubjectCalendarPage).toHaveBeenCalledWith(
      expect.objectContaining({
        getCalendarUseCase: mockContainer.getBangumiCalendarUseCase,
      }),
      expect.any(Function),
    );
  });

  it("清除选中日时应从 URL 移除 day 参数", async () => {
    const user = userEvent.setup();
    mockPage();
    renderPage("/anime/calendar?platform=bangumi&day=2");

    await user.click(screen.getByText("clear-day"));

    expect(screen.getByTestId("active-day")).toHaveTextContent("null");
  });
});
