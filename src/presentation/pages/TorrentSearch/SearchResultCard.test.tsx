import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { SearchResultCard } from "./SearchResultCard";

function makeItem(
  overrides: Partial<AiSearchResultItem> = {},
): AiSearchResultItem {
  return {
    title: NonEmptyStringSchema.parse("xxx 第1集"),
    link: NonEmptyStringSchema.parse("http://example.com/1"),
    pub_date: "2026-06-23",
    magnet: NonEmptyStringSchema.parse("magnet:?xt=urn:btih:TEST1"),
    description: "",
    ...overrides,
  };
}

const renderCard = (
  overrides: Partial<AiSearchResultItem> = {},
  isBestAi = false,
) => {
  const onCopyMagnet = vi.fn();
  const onPlay = vi.fn();
  render(
    <SearchResultCard
      item={makeItem(overrides)}
      index={0}
      onCopyMagnet={onCopyMagnet}
      onPlay={onPlay}
      isBestAi={isBestAi}
    />,
  );
  return { onCopyMagnet, onPlay };
};

describe("SearchResultCard 搜索结果卡片组件", () => {
  it("应该渲染标题、网页链接与操作按钮", () => {
    renderCard();

    expect(screen.getByText("xxx 第1集")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /网页/ })).toHaveAttribute(
      "href",
      "http://example.com/1",
    );
    expect(
      screen.getByRole("button", { name: "复制磁力" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "边下边播" }),
    ).toBeInTheDocument();
  });

  it("点击复制磁力按钮时应该调用 onCopyMagnet", () => {
    const { onCopyMagnet } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "复制磁力" }));

    expect(onCopyMagnet).toHaveBeenCalledWith("magnet:?xt=urn:btih:TEST1");
  });

  it("点击边下边播按钮时应该调用 onPlay 并携带磁力与标题", () => {
    const { onPlay } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "边下边播" }));

    expect(onPlay).toHaveBeenCalledWith("magnet:?xt=urn:btih:TEST1");
  });

  it("description 默认折叠展示，点击可展开查看净化后的 HTML", () => {
    renderCard({
      description: NonEmptyStringSchema.parse(
        "<p>1080P 简体内封字幕，共 13 集合集</p>",
      ),
    });

    expect(screen.getByTestId("torrent-desc-toggle-0")).toBeInTheDocument();
    expect(
      screen.queryByText("1080P 简体内封字幕，共 13 集合集"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("torrent-desc-toggle-0"));

    expect(
      screen.getByText("1080P 简体内封字幕，共 13 集合集"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("<p>1080P 简体内封字幕，共 13 集合集</p>"),
    ).not.toBeInTheDocument();
  });

  it("渲染 description 时应该剥离 script 等危险标签", () => {
    renderCard({
      description: NonEmptyStringSchema.parse(
        "<p>安全描述</p><script>window.__xss_injected = true</script>",
      ),
    });

    fireEvent.click(screen.getByTestId("torrent-desc-toggle-0"));

    expect(screen.getByText("安全描述")).toBeInTheDocument();
    expect((window as any).__xss_injected).toBeUndefined();
  });

  it("description 为空时不应渲染描述折叠区", () => {
    renderCard();

    expect(
      screen.queryByTestId("torrent-desc-toggle-0"),
    ).not.toBeInTheDocument();
  });

  it("有 ai_score 时渲染评分徽章，isBestAi 时显示 AI 智能精选推荐", () => {
    renderCard(
      {
        ai_score: 95,
        ai_reason: "匹配 1080p 清晰度与简中字幕",
      },
      true,
    );

    expect(screen.getByText("AI 智能精选推荐")).toBeInTheDocument();
    expect(screen.getByText("匹配度: 95分")).toBeInTheDocument();
    expect(screen.getByText("匹配 1080p 清晰度与简中字幕")).toBeInTheDocument();
  });

  it("非最佳 AI 结果时显示 AI 评分过滤徽章", () => {
    renderCard({ ai_score: 75 });

    expect(screen.getByText("AI 评分过滤")).toBeInTheDocument();
  });
});
