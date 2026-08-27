import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { NextSeasonMonthGroup } from "@/domain/anime/AnimeSchemas";
import { MonthCalendar } from "./MonthCalendar";

const mockGroups: NextSeasonMonthGroup[] = [
  {
    month: 10,
    label: "10月",
    items: [
      {
        id: 1,
        name: "十月动漫A",
        image: "http://example.com/1.jpg",
        rating: 8,
      },
      { id: 2, name: "十月动漫B", image: "", rating: 0 },
    ],
  },
  {
    month: 11,
    label: "11月",
    items: [
      {
        id: 3,
        name: "十一月动漫",
        image: "http://example.com/3.jpg",
        rating: 9,
      },
    ],
  },
];

describe("MonthCalendar 月份日历组件", () => {
  it("应该渲染月份标签和第一个月的动漫列表", async () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <MonthCalendar
            groups={mockGroups}
            activeMonth={null}
            onActiveMonthChange={vi.fn()}
            onAnimeClick={vi.fn()}
          />
        ),
      },
    ]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("十月动漫A")).toBeInTheDocument();
    });

    expect(screen.getByRole("tab", { name: "10月" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "11月" })).toBeInTheDocument();
  });

  it("点击其他月份 tab 应该切换展示数据", async () => {
    function Wrapper() {
      const [activeMonth, setActiveMonth] = useState<number | null>(null);
      return (
        <MonthCalendar
          groups={mockGroups}
          activeMonth={activeMonth}
          onActiveMonthChange={setActiveMonth}
          onAnimeClick={vi.fn()}
        />
      );
    }

    const router = createMemoryRouter([{ path: "/", element: <Wrapper /> }]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("十月动漫A")).toBeInTheDocument();
    });

    await userEvent.setup().click(screen.getByRole("tab", { name: "11月" }));

    await waitFor(() => {
      expect(screen.getByText("十一月动漫")).toBeInTheDocument();
    });
  });

  it("点击动漫卡片应该调用 onAnimeClick", async () => {
    const onAnimeClick = vi.fn();
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <MonthCalendar
            groups={mockGroups}
            activeMonth={null}
            onActiveMonthChange={vi.fn()}
            onAnimeClick={onAnimeClick}
          />
        ),
      },
    ]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("十月动漫A")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("详情: 十月动漫A"));
    expect(onAnimeClick).toHaveBeenCalledOnce();
  });

  it("当前月份没有数据时应该显示暂无数据", async () => {
    const emptyGroups: NextSeasonMonthGroup[] = [
      { month: 10, label: "10月", items: [] },
    ];
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <MonthCalendar
            groups={emptyGroups}
            activeMonth={null}
            onActiveMonthChange={vi.fn()}
            onAnimeClick={vi.fn()}
          />
        ),
      },
    ]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("暂无数据")).toBeInTheDocument();
    });
  });
});
