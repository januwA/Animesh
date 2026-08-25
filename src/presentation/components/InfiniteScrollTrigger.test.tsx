import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InfiniteScrollTrigger } from "./InfiniteScrollTrigger";

let observerCallback: IntersectionObserverCallback | null = null;
class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const triggerVisible = (isIntersecting = true) => {
  observerCallback?.(
    [{ isIntersecting } as unknown as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
};

describe("InfiniteScrollTrigger 无限滚动触发器", () => {
  const originalIntersectionObserver = window.IntersectionObserver;

  beforeEach(() => {
    observerCallback = null;
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver;
  });

  it("hasMore 时展示提示文案", () => {
    render(
      <InfiniteScrollTrigger
        hasMore={true}
        loading={false}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.getByText("上滑加载更多")).toBeInTheDocument();
  });

  it("进入视口且可加载时触发 onLoadMore", () => {
    const onLoadMore = vi.fn();
    render(
      <InfiniteScrollTrigger
        hasMore={true}
        loading={false}
        onLoadMore={onLoadMore}
      />,
    );

    triggerVisible(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("loading 时展示加载文案且不触发 onLoadMore", () => {
    const onLoadMore = vi.fn();
    render(
      <InfiniteScrollTrigger
        hasMore={true}
        loading={true}
        onLoadMore={onLoadMore}
      />,
    );

    expect(screen.getByText("正在加载更多...")).toBeInTheDocument();
    triggerVisible(true);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("没有更多时展示结束文案且不触发 onLoadMore", () => {
    const onLoadMore = vi.fn();
    render(
      <InfiniteScrollTrigger
        hasMore={false}
        loading={false}
        onLoadMore={onLoadMore}
      />,
    );

    expect(screen.getByText("没有更多了")).toBeInTheDocument();
    triggerVisible(true);
    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
