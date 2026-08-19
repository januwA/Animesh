import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarSkeleton } from "./CalendarSkeleton";

describe("CalendarSkeleton 日历骨架屏组件", () => {
  it("应该渲染骨架屏容器", () => {
    render(<CalendarSkeleton />);

    expect(screen.getByTestId("calendar-skeleton")).toBeInTheDocument();
  });

  it("应该渲染 10 个卡片骨架", () => {
    const { container } = render(<CalendarSkeleton />);

    const gridContainer = container.querySelector(".grid");
    expect(gridContainer).not.toBeNull();
    const cards = gridContainer!.children;
    expect(cards).toHaveLength(10);
  });
});
