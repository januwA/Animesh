import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BangumiCalendarItem } from "@/domain/bangumi/BangumiSchemas";
import { AnimeCard } from "./AnimeCard";

const makeItem = (
  overrides: Partial<BangumiCalendarItem> = {},
): BangumiCalendarItem =>
  ({
    id: 1,
    name: "测试动漫",
    image: "http://example.com/cover.jpg",
    rating: 8.5,
    ...overrides,
  }) as unknown as BangumiCalendarItem;

describe("AnimeCard 动漫卡片组件", () => {
  it("应该渲染动漫名称、评分和收藏人数", () => {
    const item = makeItem();
    render(<AnimeCard item={item} onClick={vi.fn()} />);

    expect(screen.getByText("测试动漫")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
  });

  it("点击卡片时应该调用 onClick", () => {
    const onClick = vi.fn();
    const item = makeItem({ rating: 0 });
    render(<AnimeCard item={item} onClick={onClick} />);

    fireEvent.click(screen.getByTitle("详情: 测试动漫"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
