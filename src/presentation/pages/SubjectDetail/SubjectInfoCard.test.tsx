import { render, screen } from "@testing-library/react";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import { SubjectInfoCard } from "./SubjectInfoCard";

const makeSubject = (
  overrides: Partial<BangumiSubject> = {},
): BangumiSubject => ({
  id: 123,
  name: "测试动漫标题",
  summary: "这是一个测试动漫的简介内容。",
  image: "http://example.com/large.jpg",
  rating: 8.5,
  date: "2026-07-01",
  eps: 12,
  platform: "TV",
  ...overrides,
});

describe("SubjectInfoCard 信息卡片组件", () => {
  it("当 subject 存在时，应该展示标题、评分和平台", () => {
    render(
      <SubjectInfoCard
        subject={makeSubject()}
        subjectId={123}
        displayName="测试动漫标题"
        imageUrl="http://example.com/large.jpg"
      />,
    );

    expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
    expect(screen.getByText("TV")).toBeInTheDocument();
  });

  it("当 subject 为 undefined 时，应该显示加载状态", () => {
    render(
      <SubjectInfoCard
        subject={undefined}
        subjectId={123}
        displayName="传递的动画名称"
        imageUrl="http://example.com/passed-cover.jpg"
      />,
    );

    expect(screen.getByText("传递的动画名称")).toBeInTheDocument();
    expect(screen.getByText("正在加载动漫详情...")).toBeInTheDocument();
    const img = screen.getByRole("img", { name: "传递的动画名称" });
    expect(img.getAttribute("src")).toBe("http://example.com/passed-cover.jpg");
  });

  it("当 imageUrl 为 undefined 时，应该显示占位图标", () => {
    render(
      <SubjectInfoCard
        subject={makeSubject()}
        subjectId={123}
        displayName="测试动漫标题"
        imageUrl={undefined}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("当 API 返回字段缺失时，应该正常渲染且不报错", () => {
    render(
      <SubjectInfoCard
        subject={makeSubject({
          platform: null as never,
          rating: 0,
          date: null as never,
          eps: null as never,
        })}
        subjectId={123}
        displayName="Test Anime Title"
        imageUrl="http://example.com/large.jpg"
      />,
    );

    expect(screen.getByText("Test Anime Title")).toBeInTheDocument();
    expect(screen.queryByText("TV")).not.toBeInTheDocument();
  });

  it("当在看人数为空时，不应该显示评分", () => {
    render(
      <SubjectInfoCard
        subject={makeSubject({
          rating: 8.5,
        })}
        subjectId={123}
        displayName="测试动漫标题"
        imageUrl="http://example.com/large.jpg"
      />,
    );

    expect(screen.queryByTestId("rating-total")).not.toBeInTheDocument();
  });
});
