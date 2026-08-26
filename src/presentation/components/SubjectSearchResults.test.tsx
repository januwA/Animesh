import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { SubjectSearchResults } from "./SubjectSearchResults";

function makeSubject(overrides: Partial<AnimeSubject> = {}): AnimeSubject {
  return {
    id: 1,
    name: "间谍过家家",
    summary: "简介",
    image: "https://img.example/l.jpg",
    rating: 8.5,
    date: "2022-04-09",
    eps: 12,
    platform: "TV",
    ...overrides,
  };
}

describe("SubjectSearchResults 搜索结果列表", () => {
  it("空结果时渲染空状态提示", () => {
    render(
      <SubjectSearchResults
        items={[]}
        onSubjectClick={() => {}}
        hasMore={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.getByText("未找到相关条目")).toBeInTheDocument();
    expect(screen.getByText("换个关键词试试")).toBeInTheDocument();
  });

  it("渲染条目卡片并展示标题与评分", () => {
    render(
      <SubjectSearchResults
        items={[makeSubject()]}
        onSubjectClick={() => {}}
        hasMore={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.getByText("间谍过家家")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
  });

  it("点击卡片触发 onSubjectClick", async () => {
    const user = userEvent.setup();
    const onSubjectClick = vi.fn();
    const subject = makeSubject({ id: 42 });
    render(
      <SubjectSearchResults
        items={[subject]}
        onSubjectClick={onSubjectClick}
        hasMore={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />,
    );

    await user.click(screen.getByTitle("详情: 间谍过家家"));
    expect(onSubjectClick).toHaveBeenCalledWith(subject);
  });

  it("有更多数据时渲染滚动加载触发器", () => {
    render(
      <SubjectSearchResults
        items={[makeSubject()]}
        onSubjectClick={() => {}}
        hasMore={true}
        loadingMore={false}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.getByTestId("infinite-scroll-trigger")).toBeInTheDocument();
    expect(screen.getByText("上滑加载更多")).toBeInTheDocument();
  });

  it("加载更多中时展示加载提示", () => {
    render(
      <SubjectSearchResults
        items={[makeSubject()]}
        onSubjectClick={() => {}}
        hasMore={true}
        loadingMore={true}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.getByText("正在加载更多...")).toBeInTheDocument();
  });
});
