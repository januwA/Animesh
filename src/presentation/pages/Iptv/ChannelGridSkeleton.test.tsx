import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChannelGridSkeleton } from "./ChannelGridSkeleton";

describe("ChannelGridSkeleton 频道骨架屏组件", () => {
  it("应该渲染骨架屏容器", () => {
    render(<ChannelGridSkeleton />);

    expect(screen.getByTestId("channel-grid-skeleton")).toBeInTheDocument();
  });

  it("应该渲染 10 个骨架卡片", () => {
    const { container } = render(<ChannelGridSkeleton />);

    const cards = container.querySelectorAll(
      '[data-testid="channel-grid-skeleton"] > div',
    );
    expect(cards).toHaveLength(10);
  });
});
