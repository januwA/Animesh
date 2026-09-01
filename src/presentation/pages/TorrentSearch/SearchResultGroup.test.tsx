import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import type { TorrentResultGroup } from "@/presentation/store/searchStore";
import { SearchResultGroup } from "./SearchResultGroup";

function makeItem(
  title: string,
  overrides: Partial<SearchResultItem> = {},
): SearchResultItem {
  return {
    title: NonEmptyStringSchema.parse(title),
    link: NonEmptyStringSchema.parse("http://example.com/1"),
    pub_date: "2026-06-23",
    magnet: NonEmptyStringSchema.parse("magnet:?xt=urn:btih:TEST1"),
    description: "",
    ...overrides,
  };
}

function makeGroup(
  name: string,
  startIndex: number,
  items: SearchResultItem[],
): TorrentResultGroup {
  return { name, startIndex, items };
}

describe("SearchResultGroup 搜索结果分组组件", () => {
  it("应该渲染分组名称与数量徽章", () => {
    render(
      <SearchResultGroup
        group={makeGroup("GroupA", 0, [makeItem("xxx 01")])}
        open={true}
        onOpenChange={vi.fn()}
        onCopyMagnet={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    expect(screen.getByText("GroupA")).toBeInTheDocument();
    expect(screen.getByText("1 个")).toBeInTheDocument();
  });

  it("展开状态下渲染组内的结果卡片", () => {
    render(
      <SearchResultGroup
        group={makeGroup("GroupA", 0, [makeItem("xxx 01"), makeItem("xxx 02")])}
        open={true}
        onOpenChange={vi.fn()}
        onCopyMagnet={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    expect(screen.getByText("xxx 01")).toBeInTheDocument();
    expect(screen.getByText("xxx 02")).toBeInTheDocument();
  });

  it("折叠状态下不渲染组内结果卡片", () => {
    render(
      <SearchResultGroup
        group={makeGroup("GroupA", 0, [makeItem("xxx 01")])}
        open={false}
        onOpenChange={vi.fn()}
        onCopyMagnet={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    expect(screen.queryByText("xxx 01")).not.toBeInTheDocument();
  });

  it("点击分组触发 onOpenChange", () => {
    const onOpenChange = vi.fn();
    render(
      <SearchResultGroup
        group={makeGroup("GroupA", 0, [makeItem("xxx 01")])}
        open={true}
        onOpenChange={onOpenChange}
        onCopyMagnet={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("group-trigger-GroupA"));

    expect(onOpenChange).toHaveBeenCalled();
  });
});
