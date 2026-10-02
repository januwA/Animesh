import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIContext } from "@/di/DIContext";
import type {
  AnimeCalendarDay,
  AnimeCalendarItem,
} from "@/domain/anime/AnimeSchemas";
import SubjectCalendar from "./index";

vi.mock(import("@/presentation/hooks/useQuery"), () => ({
  useQuery: vi.fn(),
}));
vi.mock(import("react-router-dom"), async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});
vi.mock(import("./WeeklyCalendar"), () => ({
  WeeklyCalendar: vi.fn(
    ({
      calendarActiveDay,
      onActiveDayChange,
      onAnimeClick,
    }: {
      calendarActiveDay: number | null;
      onActiveDayChange: (dayId: number | null) => void;
      onAnimeClick: (item: AnimeCalendarItem) => void;
    }) => (
      <div>
        <span data-testid="active-day">{String(calendarActiveDay)}</span>
        <button type="button" onClick={() => onActiveDayChange(3)}>
          select-day-3
        </button>
        <button type="button" onClick={() => onActiveDayChange(null)}>
          clear-day
        </button>
        <button
          type="button"
          onClick={() =>
            onAnimeClick({
              id: 123,
              name: "测试动漫",
              image: "http://example.com/cover.jpg",
              rating: 0,
            })
          }
        >
          click-anime
        </button>
      </div>
    ),
  ),
}));

import { useNavigate } from "react-router-dom";
import { useQuery } from "@/presentation/hooks/useQuery";

vi.mocked(useNavigate).mockReturnValue(vi.fn());

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

const mockQuery = (overrides: Partial<ReturnType<typeof useQuery>> = {}) => {
  vi.mocked(useQuery).mockReturnValue({
    data: [mockCalendarDay],
    loading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  });
};

describe("SubjectCalendar 页面", () => {
  it("缺少 platform 参数时应渲染参数错误视图", () => {
    mockQuery();
    renderPage("/anime/calendar");
    expect(screen.getByText("无效的日历参数")).toBeInTheDocument();
  });

  it("day 参数超出 1-7 范围时应渲染参数错误视图", () => {
    mockQuery();
    renderPage("/anime/calendar?platform=bangumi&day=9");
    expect(screen.getByText("无效的日历参数")).toBeInTheDocument();
    expect(screen.getByText("无效的星期参数")).toBeInTheDocument();
  });

  it("day 参数非数字时应渲染参数错误视图", () => {
    mockQuery();
    renderPage("/anime/calendar?platform=bangumi&day=abc");
    expect(screen.getByText("无效的日历参数")).toBeInTheDocument();
  });

  it("无 day 参数时应以 null 作为选中日", () => {
    mockQuery();
    renderPage("/anime/calendar?platform=bangumi");
    expect(screen.getByTestId("active-day")).toHaveTextContent("null");
  });

  it("合法 day 参数时应以该值作为选中日", () => {
    mockQuery();
    renderPage("/anime/calendar?platform=bangumi&day=5");
    expect(screen.getByTestId("active-day")).toHaveTextContent("5");
  });

  it("切换选中日时应写入 URL 查询参数", async () => {
    const user = userEvent.setup();
    mockQuery();
    renderPage("/anime/calendar?platform=bangumi");

    await user.click(screen.getByText("select-day-3"));

    expect(screen.getByTestId("active-day")).toHaveTextContent("3");
  });

  it("清除选中日时应从 URL 移除 day 参数", async () => {
    const user = userEvent.setup();
    mockQuery();
    renderPage("/anime/calendar?platform=bangumi&day=2");

    await user.click(screen.getByText("clear-day"));

    expect(screen.getByTestId("active-day")).toHaveTextContent("null");
  });

  it("点击动漫时应导航到 subject 页面并传递名称与封面", async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    mockQuery();
    renderPage("/anime/calendar?platform=bangumi");

    await user.click(screen.getByText("click-anime"));

    expect(mockNavigate).toHaveBeenCalledWith(
      "/anime/subject/123?platform=bangumi",
      {
        viewTransition: true,
        state: {
          name: "测试动漫",
          imageUrl: "http://example.com/cover.jpg",
        },
      },
    );
  });

  it("请求失败时应渲染错误视图", () => {
    mockQuery({
      data: null,
      error: new Error("API error"),
    });
    renderPage("/anime/calendar?platform=bangumi");
    expect(screen.getByText("获取新番日历失败")).toBeInTheDocument();
    expect(screen.getByText("API error")).toBeInTheDocument();
  });

  it("加载中时应渲染骨架屏", () => {
    mockQuery({ data: null, loading: true });
    renderPage("/anime/calendar?platform=bangumi");
    expect(screen.getByTestId("calendar-skeleton")).toBeInTheDocument();
  });
});
