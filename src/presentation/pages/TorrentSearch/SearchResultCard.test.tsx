import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { TranslatableText } from "@/presentation/components/TranslatableText";
import { SearchResultCard } from "./SearchResultCard";

// 测试替身：按真实组件把 text 当作 HTML 渲染。净化细节由 sanitizeHtml.test.ts 单独覆盖，
// 这里不再复刻 DOMPurify 行为，只保留折叠展开时文本可见的能力。
vi.mock(import("@/presentation/components/TranslatableText"), () => ({
  TranslatableText: vi.fn(({ text, as, className, toolbarClassName }) => {
    const Tag = as ?? "div";
    return (
      <div className={toolbarClassName}>
        <Tag
          className={className}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 测试替身
          dangerouslySetInnerHTML={{ __html: text }}
        />
      </div>
    );
  }),
}));

const TranslatableTextMock = vi.mocked(TranslatableText);

function makeItem(overrides: Partial<SearchResultItem> = {}): SearchResultItem {
  return {
    title: NonEmptyStringSchema.parse("xxx 第1集"),
    link: NonEmptyStringSchema.parse("http://example.com/1"),
    pub_date: "2026-06-23",
    magnet: NonEmptyStringSchema.parse("magnet:?xt=urn:btih:TEST1"),
    description: "",
    ...overrides,
  };
}

const renderCard = (overrides: Partial<SearchResultItem> = {}) => {
  const onCopyMagnet = vi.fn();
  const onPlay = vi.fn();
  render(
    <SearchResultCard
      item={makeItem(overrides)}
      index={0}
      onCopyMagnet={onCopyMagnet}
      onPlay={onPlay}
    />,
  );
  return { onCopyMagnet, onPlay };
};

describe("SearchResultCard 搜索结果卡片组件", () => {
  beforeEach(() => {
    TranslatableTextMock.mockClear();
  });

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

  it("description 以 renderHtml 方式交给 TranslatableText 净化渲染", () => {
    renderCard({
      description: NonEmptyStringSchema.parse("<p>安全描述</p>"),
    });

    fireEvent.click(screen.getByTestId("torrent-desc-toggle-0"));

    expect(TranslatableTextMock.mock.calls[0][0]).toMatchObject({
      text: "<p>安全描述</p>",
      renderHtml: true,
      as: "div",
    });
  });

  it("description 为空时不应渲染描述折叠区", () => {
    renderCard();

    expect(
      screen.queryByTestId("torrent-desc-toggle-0"),
    ).not.toBeInTheDocument();
  });
});
