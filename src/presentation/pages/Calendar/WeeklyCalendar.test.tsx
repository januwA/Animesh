import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnimeCalendarDay } from "@/domain/anime/AnimeSchemas";
import { resetAppStores } from "@/test/store-reset";
import { WeeklyCalendar } from "./WeeklyCalendar";

const makeCalendar = (todayId: number): AnimeCalendarDay[] => [
  {
    weekday: { id: todayId },
    items: [
      {
        id: 1,
        name: "今天动漫",
        image: "http://example.com/cover.jpg",
        rating: 0,
      },
    ],
  },
  {
    weekday: {
      id: todayId === 1 ? 2 : 1,
    },
    items: [
      {
        image: "",
        id: 2,
        name: "其他动漫",
        rating: 0,
      },
    ],
  },
];

describe("WeeklyCalendar 周历组件", () => {
  beforeEach(() => {
    resetAppStores();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("应该渲染星期标签和当天的动漫列表", async () => {
    const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
    const onAnimeClick = vi.fn();
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <WeeklyCalendar
            calendar={makeCalendar(todayId)}
            onAnimeClick={onAnimeClick}
          />
        ),
      },
    ]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("今天动漫")).toBeInTheDocument();
    });

    expect(screen.getByRole("tab", { name: "一" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "日" })).toBeInTheDocument();
  });

  it("点击其他星期 tab 应该切换展示数据", async () => {
    const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
    const otherDayId = todayId === 1 ? 2 : 1;
    const labels = ["一", "二", "三", "四", "五", "六", "日"];
    const onAnimeClick = vi.fn();
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <WeeklyCalendar
            calendar={makeCalendar(todayId)}
            onAnimeClick={onAnimeClick}
          />
        ),
      },
    ]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("今天动漫")).toBeInTheDocument();
    });

    await userEvent
      .setup()
      .click(screen.getByRole("tab", { name: labels[otherDayId - 1] }));

    await waitFor(() => {
      expect(screen.getByText("其他动漫")).toBeInTheDocument();
    });
  });

  it("当天没有数据时应该显示暂无更新", async () => {
    const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
    const calendar: AnimeCalendarDay[] = [
      {
        weekday: { id: todayId },
        items: [],
      },
    ];
    const router = createMemoryRouter([
      {
        path: "/",
        element: <WeeklyCalendar calendar={calendar} onAnimeClick={vi.fn()} />,
      },
    ]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("暂无更新")).toBeInTheDocument();
    });
  });

  it("点击动漫卡片应该调用 onAnimeClick", async () => {
    const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
    const onAnimeClick = vi.fn();
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <WeeklyCalendar
            calendar={makeCalendar(todayId)}
            onAnimeClick={onAnimeClick}
          />
        ),
      },
    ]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("今天动漫")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("详情: 今天动漫"));
    expect(onAnimeClick).toHaveBeenCalledOnce();
  });

  it("今天不是当前活跃 tab 时应该显示今天标记圆点", async () => {
    const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();
    const calendar = makeCalendar(todayId);
    const labels = ["一", "二", "三", "四", "五", "六", "日"];
    const router = createMemoryRouter([
      {
        path: "/",
        element: <WeeklyCalendar calendar={calendar} onAnimeClick={vi.fn()} />,
      },
    ]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("今天动漫")).toBeInTheDocument();
    });

    const todayTab = screen.getByRole("tab", { name: labels[todayId - 1] });
    expect(todayTab).toBeInTheDocument();

    const todayTabButton = todayTab.querySelector('[role="tab"]') || todayTab;
    expect(todayTabButton.classList.contains("bg-primary")).toBe(false);
  });

  it("今天是周日时应该激活星期日并展示当日动漫", async () => {
    vi.spyOn(Date.prototype, "getDay").mockReturnValue(0);
    const calendar: AnimeCalendarDay[] = [
      {
        weekday: { id: 7 },
        items: [
          {
            id: 3,
            name: "周日动漫",
            image: "",
            rating: 0,
          },
        ],
      },
    ];
    const router = createMemoryRouter([
      {
        path: "/",
        element: <WeeklyCalendar calendar={calendar} onAnimeClick={vi.fn()} />,
      },
    ]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("周日动漫")).toBeInTheDocument();
    });

    const sundayTab = screen.getByRole("tab", { name: "日" });
    const sundayTabButton =
      sundayTab.querySelector('[role="tab"]') || sundayTab;
    expect(sundayTabButton.getAttribute("data-state")).toBe("active");
  });

  it("周历数据中不存在活跃天时应该显示暂无更新", async () => {
    vi.spyOn(Date.prototype, "getDay").mockReturnValue(3);
    const calendar: AnimeCalendarDay[] = [
      {
        weekday: { id: 1 },
        items: [
          {
            id: 9,
            name: "周一动漫",
            image: "",
            rating: 0,
          },
        ],
      },
    ];
    const router = createMemoryRouter([
      {
        path: "/",
        element: <WeeklyCalendar calendar={calendar} onAnimeClick={vi.fn()} />,
      },
    ]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("暂无更新")).toBeInTheDocument();
    });
  });
});
