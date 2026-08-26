import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { SubjectInfoCard } from "@/presentation/components/SubjectInfoCard";
import { resetAppStores } from "@/test/store-reset";

const makeSubject = (overrides: Partial<AnimeSubject> = {}): AnimeSubject => ({
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

const renderCard = async (
  subject: AnimeSubject | undefined,
  options: { displayName?: string; imageUrl?: string } = {},
) => {
  const result = render(
    <SubjectInfoCard
      subject={subject}
      subjectId={123}
      platform="bangumi"
      displayName={options.displayName ?? "测试动漫标题"}
      imageUrl={options.imageUrl}
      onOpenUrl={vi.fn()}
      getFavoriteStatusUseCase={{ execute: vi.fn().mockResolvedValue(false) }}
      addFavoriteUseCase={{ execute: vi.fn().mockResolvedValue(undefined) }}
      removeFavoriteUseCase={{ execute: vi.fn().mockResolvedValue(undefined) }}
    />,
  );
  if (subject) {
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /收藏/ })).toBeInTheDocument();
    });
  }
  return result;
};

describe("SubjectInfoCard 信息卡片组件", () => {
  beforeEach(() => {
    resetAppStores();
  });

  it("当 subject 存在时，应该展示标题、评分和平台", async () => {
    await renderCard(makeSubject());

    expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
    expect(screen.getByText("TV")).toBeInTheDocument();
  });

  it("当 subject 为 undefined 时，应该显示加载状态", async () => {
    await renderCard(undefined, {
      displayName: "传递的动画名称",
      imageUrl: "http://example.com/large.jpg",
    });

    expect(screen.getByText("传递的动画名称")).toBeInTheDocument();
    expect(screen.getByText("正在加载动漫详情...")).toBeInTheDocument();
    const img = screen.getByRole("img", { name: "传递的动画名称" });
    expect(img.getAttribute("src")).toBe("http://example.com/large.jpg");
  });

  it("当 imageUrl 为 undefined 时，应该显示占位图标", async () => {
    await renderCard(makeSubject(), { imageUrl: undefined });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("当 API 返回字段缺失时，应该正常渲染且不报错", async () => {
    await renderCard(
      makeSubject({
        platform: null as never,
        rating: 0,
        date: null as never,
        eps: null as never,
      }),
      { displayName: "Test Anime Title" },
    );

    expect(screen.getByText("Test Anime Title")).toBeInTheDocument();
    expect(screen.queryByText("TV")).not.toBeInTheDocument();
  });

  it("当在看人数为空时，不应该显示评分", async () => {
    await renderCard(
      makeSubject({
        rating: 8.5,
      }),
    );

    expect(screen.queryByTestId("rating-total")).not.toBeInTheDocument();
  });

  it("当 subject 存在时，应该展示话数、首播日期与简介预览", async () => {
    await renderCard(makeSubject());

    expect(screen.getByText("共 12 话")).toBeInTheDocument();
    expect(screen.getByText("2026-07-01")).toBeInTheDocument();
    expect(
      screen.getByText("这是一个测试动漫的简介内容。"),
    ).toBeInTheDocument();
  });

  it("当简介为空时，应该隐藏简介预览", async () => {
    await renderCard(makeSubject({ summary: "" }));

    expect(
      screen.queryByText("这是一个测试动漫的简介内容。"),
    ).not.toBeInTheDocument();
  });

  it("统计区字段缺失时，应该隐藏对应的统计项", async () => {
    await renderCard(
      makeSubject({
        date: null as never,
        eps: null as never,
        platform: null as never,
      }),
    );

    expect(screen.queryByText("共 12 话")).not.toBeInTheDocument();
    expect(screen.queryByText("2026-07-01")).not.toBeInTheDocument();
    expect(screen.queryByText("TV")).not.toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
  });
});
