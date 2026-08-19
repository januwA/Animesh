import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";
import { CollectionCard } from "./CollectionCard";

const makeItem = (overrides: Partial<FavoriteItem> = {}): FavoriteItem =>
  ({
    subjectId: 101,
    name: "测试动画",
    imageUrl: null,
    ...overrides,
  }) as FavoriteItem;

describe("CollectionCard 收藏卡片组件", () => {
  it("应该渲染收藏名称", () => {
    const item = makeItem();
    render(<CollectionCard item={item} onClick={vi.fn()} />);

    expect(screen.getByText("测试动画")).toBeInTheDocument();
  });

  it("有封面时应该渲染 LazyImage 容器", () => {
    const item = makeItem({ imageUrl: "http://example.com/cover.jpg" });
    const { container } = render(
      <CollectionCard item={item} onClick={vi.fn()} />,
    );

    const imgContainer = container.querySelector(".relative.w-full.h-full");
    expect(imgContainer).toBeInTheDocument();
  });

  it("没有封面时应该显示占位图标", () => {
    const item = makeItem({ imageUrl: null });
    const { container } = render(
      <CollectionCard item={item} onClick={vi.fn()} />,
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("点击卡片时应该调用 onClick", () => {
    const onClick = vi.fn();
    const item = makeItem();
    render(<CollectionCard item={item} onClick={onClick} />);

    fireEvent.click(screen.getByTitle("详情: 测试动画"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
