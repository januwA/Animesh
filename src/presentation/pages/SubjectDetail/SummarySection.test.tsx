import { render, screen } from "@testing-library/react";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import { SummarySection } from "./SummarySection";

const makeSubject = (
  overrides: Partial<BangumiSubject> = {},
): BangumiSubject => ({
  id: 123,
  name: "Test Anime Title",
  name_cn: "测试动漫标题",
  summary: "这是一个测试动漫的简介内容。",
  images: {
    large: "http://example.com/large.jpg",
    common: "http://example.com/common.jpg",
    medium: "http://example.com/medium.jpg",
    small: "http://example.com/small.jpg",
    grid: "http://example.com/grid.jpg",
  },
  rating: { score: 8.5, rank: 42, total: 1000 },
  collection: { wish: 100, collect: 500, doing: 200, on_hold: 50, dropped: 10 },
  date: "2026-07-01",
  eps: 12,
  platform: "TV",
  ...overrides,
});

describe("SummarySection 简介区域组件", () => {
  it("当 subject 存在时，应该显示剧情简介内容", () => {
    render(<SummarySection subject={makeSubject()} />);

    expect(screen.getByText("剧情简介")).toBeInTheDocument();
    expect(
      screen.getByText("这是一个测试动漫的简介内容。"),
    ).toBeInTheDocument();
  });

  it("当 subject 为 undefined 时，应该显示骨架屏", () => {
    const { container } = render(<SummarySection subject={undefined} />);

    expect(screen.queryByText("剧情简介")).not.toBeInTheDocument();
    // Skeleton elements should be rendered
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("当 summary 为空时，应该正常渲染而不报错", () => {
    render(<SummarySection subject={makeSubject({ summary: "" })} />);

    expect(screen.getByText("剧情简介")).toBeInTheDocument();
  });
});
