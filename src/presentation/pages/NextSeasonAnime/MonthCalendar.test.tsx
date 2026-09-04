import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { MonthCalendar } from "./MonthCalendar";

const mockTabs = [
  { month: 10, label: "10月" },
  { month: 11, label: "11月" },
  { month: 12, label: "12月" },
];

const mockItems: AnimeSubject[] = [
  {
    id: 1,
    name: "十月动漫A",
    image: "http://example.com/1.jpg",
    rating: 8,
    summary: "",
  },
  { id: 2, name: "十月动漫B", image: "", rating: 0, summary: "" },
];

function renderMonthCalendar(
  props: Partial<React.ComponentProps<typeof MonthCalendar>> = {},
) {
  const defaultProps = {
    tabs: mockTabs,
    activeMonth: 10,
    onActiveMonthChange: vi.fn(),
    items: mockItems,
    isLoading: false,
    error: null,
    onRetry: vi.fn(),
    hasMore: false,
    loadingMore: false,
    onLoadMore: vi.fn(),
    onAnimeClick: vi.fn(),
    ...props,
  };

  const router = createMemoryRouter([
    {
      path: "/",
      element: <MonthCalendar {...defaultProps} />,
    },
  ]);

  return {
    ...render(<RouterProvider router={router} />),
    props: defaultProps,
  };
}

describe("MonthCalendar 月份日历组件", () => {
  it("应该渲染月份标签和当前月份的动漫列表", () => {
    renderMonthCalendar();

    expect(screen.getByText("十月动漫A")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "10月" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "11月" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "12月" })).toBeInTheDocument();
  });

  it("点击其他月份 tab 应该调用 onActiveMonthChange", async () => {
    const onActiveMonthChange = vi.fn();
    renderMonthCalendar({ onActiveMonthChange });

    await userEvent.setup().click(screen.getByRole("tab", { name: "11月" }));
    expect(onActiveMonthChange).toHaveBeenCalledWith(11);
  });

  it("点击动漫卡片应该调用 onAnimeClick", () => {
    const onAnimeClick = vi.fn();
    renderMonthCalendar({ onAnimeClick });

    fireEvent.click(screen.getByTitle("详情: 十月动漫A"));
    expect(onAnimeClick).toHaveBeenCalledOnce();
  });

  it("isLoading 为 true 时应该显示骨架屏", () => {
    renderMonthCalendar({ isLoading: true, items: [] });
    expect(screen.queryByText("十月动漫A")).not.toBeInTheDocument();
  });

  it("error 存在时应该显示错误状态并能重试", () => {
    const onRetry = vi.fn();
    renderMonthCalendar({ error: "网络连接失败", onRetry, items: [] });

    expect(screen.getByText("获取下季新番失败")).toBeInTheDocument();
    expect(screen.getByText("网络连接失败")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("当前月份没有数据时应该显示暂无数据", () => {
    renderMonthCalendar({ items: [] });
    expect(screen.getByText("暂无数据")).toBeInTheDocument();
  });

  it("有更多数据时应该渲染 InfiniteScrollTrigger", () => {
    renderMonthCalendar({ hasMore: true });
    expect(screen.getByTestId("infinite-scroll-trigger")).toBeInTheDocument();
    expect(screen.getByText("上滑加载更多")).toBeInTheDocument();
  });
});
