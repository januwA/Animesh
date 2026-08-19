import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BangumiCalendarItem } from "@/domain/bangumi/BangumiSchemas";
import { AnimeCard } from "./AnimeCard";

const makeItem = (
  overrides: Partial<BangumiCalendarItem> = {},
): BangumiCalendarItem =>
  ({
    id: 1,
    name: "Test Anime",
    name_cn: "测试动漫",
    images: { large: "http://example.com/cover.jpg", medium: "" },
    rating: { score: 8.5 },
    collection: { doing: 1200 },
    rank: 1,
    ...overrides,
  }) as unknown as BangumiCalendarItem;

describe("AnimeCard 动漫卡片组件", () => {
  it("应该渲染动漫名称、评分和收藏人数", () => {
    const item = makeItem();
    render(<AnimeCard item={item} onClick={vi.fn()} />);

    expect(screen.getByText("测试动漫")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
  });

  it("当 name_cn 为空时应该回退显示 name", () => {
    const item = makeItem({ name_cn: "" });
    render(<AnimeCard item={item} onClick={vi.fn()} />);

    expect(screen.getByText("Test Anime")).toBeInTheDocument();
  });

  it("点击卡片时应该调用 onClick", () => {
    const onClick = vi.fn();
    const item = makeItem();
    render(<AnimeCard item={item} onClick={onClick} />);

    fireEvent.click(screen.getByTitle("详情: 测试动漫"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("没有封面图时应该显示占位图标", () => {
    const item = makeItem({ images: undefined });
    const { container } = render(<AnimeCard item={item} onClick={vi.fn()} />);

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("没有评分和收藏时不应该渲染对应元素", () => {
    const item = makeItem({ rating: undefined, collection: undefined });
    render(<AnimeCard item={item} onClick={vi.fn()} />);

    expect(screen.queryByText("8.5")).not.toBeInTheDocument();
    expect(screen.queryByText("1,200")).not.toBeInTheDocument();
  });
});
