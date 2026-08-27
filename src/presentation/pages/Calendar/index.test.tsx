import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DIContainer, DIContext } from "@/di/DIContext";
import type {
  AnimeCalendarDay,
  AnimePlatform,
} from "@/domain/anime/AnimeSchemas";
import Calendar from "./index";
import { useCalendarPage } from "./useCalendarPage";

vi.mock("./useCalendarPage", () => ({
  useCalendarPage: vi.fn(),
}));

vi.mock("@/presentation/components/WeeklyCalendar", () => ({
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
    vi.mocked(useCalendarPage).mockReturnValue(mockPageReturn);
  });

  it("默认渲染 Bangumi 新番日历标题并注入 bangumi UseCase", () => {
    renderWithProviders(<Calendar />);

    expect(
      screen.getByRole("heading", { name: "新番日历" }),
    ).toBeInTheDocument();
    expect(useCalendarPage).toHaveBeenCalledWith(
      { getCalendarUseCase: mockDI.getBangumiCalendarUseCase },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("platform='anilist' 时渲染 AniList 周放送标题并注入 anilist UseCase", () => {
    renderWithProviders(<Calendar platform="anilist" />);

    expect(
      screen.getByRole("heading", { name: "AniList 周放送" }),
    ).toBeInTheDocument();
    expect(useCalendarPage).toHaveBeenCalledWith(
      { getCalendarUseCase: mockDI.getAnilistCalendarUseCase },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("传递非法 platform 参数时渲染 InvalidParamsView", () => {
    renderWithProviders(
      <Calendar platform={"invalid_platform" as AnimePlatform} />,
    );

    expect(screen.getByText("无效的平台参数")).toBeInTheDocument();
  });

  it("加载中时渲染 CalendarSkeleton", () => {
    vi.mocked(useCalendarPage).mockReturnValue({
      ...mockPageReturn,
      isLoading: true,
    });

    renderWithProviders(<Calendar />);

    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("错误时渲染 ErrorState 并支持重试", () => {
    vi.mocked(useCalendarPage).mockReturnValue({
      ...mockPageReturn,
      error: new Error("获取日历失败"),
    });

    renderWithProviders(<Calendar platform="anilist" />);

    expect(screen.getByText("获取 AniList 数据失败")).toBeInTheDocument();
    expect(screen.getByText("获取日历失败")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: "重试" });
    fireEvent.click(retryBtn);
    expect(mockPageReturn.refetch).toHaveBeenCalled();
  });

  it("数据为空时根据平台渲染对应空提示", () => {
    vi.mocked(useCalendarPage).mockReturnValue({
      ...mockPageReturn,
      calendar: [],
    });

    renderWithProviders(<Calendar platform="anilist" />);

    expect(screen.getByText("未找到放送数据")).toBeInTheDocument();
  });

  it("有数据时渲染 WeeklyCalendar", () => {
    vi.mocked(useCalendarPage).mockReturnValue({
      ...mockPageReturn,
      calendar: [
        {
          weekday: { id: 1 },
          items: [],
        },
      ],
    });

    renderWithProviders(<Calendar />);

    expect(screen.getByTestId("weekly-calendar")).toBeInTheDocument();
    expect(screen.getByText("Day 1")).toBeInTheDocument();
  });
});
