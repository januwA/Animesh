import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DIContainer, DIContext } from "@/di/DIContext";
import type {
  AnimeCalendarDay,
  AnimePlatform,
} from "@/domain/anime/AnimeSchemas";
import SubjectCalendar from "./index";
import { useSubjectCalendarPage } from "./useSubjectCalendarPage";

vi.mock(import("./useSubjectCalendarPage"), () => ({
  useSubjectCalendarPage: vi.fn(),
}));

vi.mock(import("@/presentation/components/WeeklyCalendar"), () => ({
  WeeklyCalendar: ({ calendar }: { calendar: AnimeCalendarDay[] }) => (
    <div data-testid="weekly-calendar">
      {calendar.map((c) => (
        <span key={c.weekday.id}>Day {c.weekday.id}</span>
      ))}
    </div>
  ),
}));

const mockPageReturn = {
  calendar: [] as AnimeCalendarDay[],
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
  handleAnimeClick: vi.fn(),
};

const mockDI = {
  getBangumiCalendarUseCase: { execute: vi.fn() },
  getAnilistCalendarUseCase: { execute: vi.fn() },
} as unknown as DIContainer;

function renderWithProviders(ui: ReactNode) {
  return render(
    <DIContext value={mockDI}>
      <MemoryRouter>{ui}</MemoryRouter>
    </DIContext>,
  );
}

describe("Calendar 组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSubjectCalendarPage).mockReturnValue(mockPageReturn);
  });

  it("默认渲染 Bangumi 新番日历标题并注入 bangumi UseCase", () => {
    renderWithProviders(<SubjectCalendar />);

    expect(
      screen.getByRole("heading", { name: "Bangumi 周放送" }),
    ).toBeInTheDocument();
    expect(useSubjectCalendarPage).toHaveBeenCalledWith(
      { getCalendarUseCase: mockDI.getBangumiCalendarUseCase },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("platform='anilist' 时渲染 AniList 周放送标题并注入 anilist UseCase", () => {
    renderWithProviders(<SubjectCalendar platform="anilist" />);

    expect(
      screen.getByRole("heading", { name: "AniList 周放送" }),
    ).toBeInTheDocument();
    expect(useSubjectCalendarPage).toHaveBeenCalledWith(
      { getCalendarUseCase: mockDI.getAnilistCalendarUseCase },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("传递非法 platform 参数时渲染 InvalidParamsView", () => {
    renderWithProviders(
      <SubjectCalendar platform={"invalid_platform" as AnimePlatform} />,
    );

    expect(screen.getByText("无效的平台参数")).toBeInTheDocument();
  });

  it("加载中时渲染 CalendarSkeleton", () => {
    vi.mocked(useSubjectCalendarPage).mockReturnValue({
      ...mockPageReturn,
      isLoading: true,
    });

    renderWithProviders(<SubjectCalendar />);

    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("错误时渲染 ErrorState 并支持重试", () => {
    vi.mocked(useSubjectCalendarPage).mockReturnValue({
      ...mockPageReturn,
      error: new Error("获取日历失败"),
    });

    renderWithProviders(<SubjectCalendar platform="anilist" />);

    expect(screen.getByText("获取新番日历失败")).toBeInTheDocument();
    expect(screen.getByText("获取日历失败")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: "重试" });
    fireEvent.click(retryBtn);
    expect(mockPageReturn.refetch).toHaveBeenCalled();
  });

  it("数据为空时根据平台渲染对应空提示", () => {
    vi.mocked(useSubjectCalendarPage).mockReturnValue({
      ...mockPageReturn,
      calendar: [],
    });

    renderWithProviders(<SubjectCalendar platform="anilist" />);

    expect(screen.getByText("未找到新番数据")).toBeInTheDocument();
  });

  it("有数据时渲染 WeeklyCalendar", () => {
    vi.mocked(useSubjectCalendarPage).mockReturnValue({
      ...mockPageReturn,
      calendar: [
        {
          weekday: { id: 1 },
          items: [],
        },
      ],
    });

    renderWithProviders(<SubjectCalendar />);

    expect(screen.getByTestId("weekly-calendar")).toBeInTheDocument();
    expect(screen.getByText("Day 1")).toBeInTheDocument();
  });
});
