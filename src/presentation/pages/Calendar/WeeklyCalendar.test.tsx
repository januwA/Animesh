import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";
import { resetAppStores } from "@/test/store-reset";
import { WeeklyCalendar } from "./WeeklyCalendar";

const makeCalendar = (todayId: number): BangumiCalendarDay[] => [
  {
    weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
    items: [
      {
        id: 1,
        url: "http://example.com/1",
        name: "Today Anime",
        name_cn: "今天动漫",
        air_date: "2026-01-01",
        air_weekday: todayId,
        images: {
          large: "http://example.com/cover.jpg",
          common: "",
          medium: "",
          small: "",
          grid: "",
        },
        rating: { total: 100, score: 8.5 },
        collection: { doing: 1200 },
        rank: 1,
      },
    ],
  },
  {
    weekday: {
      id: todayId === 1 ? 2 : 1,
      en: "other",
      cn: "其他",
      ja: "other",
    },
    items: [
      {
        id: 2,
        url: "http://example.com/2",
        name: "Other Anime",
        name_cn: "其他动漫",
        air_date: "2026-01-02",
        air_weekday: todayId === 1 ? 2 : 1,
        rank: 2,
      },
    ],
  },
];

describe("WeeklyCalendar 周历组件", () => {
  beforeEach(() => {
    resetAppStores();
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
    const calendar: BangumiCalendarDay[] = [
      {
        weekday: { id: todayId, en: "today", cn: "今天", ja: "today" },
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
});
