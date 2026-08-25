import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";
import type { TorrentResultGroup } from "@/presentation/store/searchStore";
import { SearchResultsList } from "./SearchResultsList";

function makeItem(title: string): AiSearchResultItem {
  return {
    title: NonEmptyStringSchema.parse(title),
    link: NonEmptyStringSchema.parse("http://example.com/1"),
    pub_date: "2026-06-23",
    magnet: NonEmptyStringSchema.parse("magnet:?xt=urn:btih:TEST1"),
    description: "",
  };
}

function makeGroup(
  name: string,
  startIndex: number,
  ...titles: string[]
): TorrentResultGroup {
  return {
    name,
    startIndex,
    items: titles.map(makeItem),
  };
}

describe("SearchResultsList 搜索结果列表组件", () => {
  it("应该渲染资源与字幕组统计", () => {
    render(
      <SearchResultsList
        totalCount={3}
        groupCount={2}
        allGroupsCollapsed={false}
        onToggleAllGroups={vi.fn()}
        groups={[
          makeGroup("GroupA", 0, "xxx 01", "xxx 02"),
          makeGroup("GroupB", 2, "xxx 03"),
        ]}
        collapsedGroups={new Set()}
        onToggleGroup={vi.fn()}
        onCopyMagnet={vi.fn()}
        onPlay={vi.fn()}
        showBestAi={false}
      />,
    );

    expect(screen.getByTestId("search-result-title")).toBeInTheDocument();
    expect(screen.getByText("GroupA")).toBeInTheDocument();
    expect(screen.getByText("GroupB")).toBeInTheDocument();
  });

  it("全部折叠时按钮显示全部展开", () => {
    render(
      <SearchResultsList
        totalCount={1}
        groupCount={1}
        allGroupsCollapsed={true}
        onToggleAllGroups={vi.fn()}
        groups={[makeGroup("GroupA", 0, "xxx 01")]}
        collapsedGroups={new Set(["GroupA"])}
        onToggleGroup={vi.fn()}
        onCopyMagnet={vi.fn()}
        onPlay={vi.fn()}
        showBestAi={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: "全部展开" }),
    ).toBeInTheDocument();
  });

  it("点击全部折叠/展开按钮调用 onToggleAllGroups", () => {
    const onToggleAllGroups = vi.fn();
    render(
      <SearchResultsList
        totalCount={1}
        groupCount={1}
        allGroupsCollapsed={false}
        onToggleAllGroups={onToggleAllGroups}
        groups={[makeGroup("GroupA", 0, "xxx 01")]}
        collapsedGroups={new Set()}
        onToggleGroup={vi.fn()}
        onCopyMagnet={vi.fn()}
        onPlay={vi.fn()}
        showBestAi={false}
      />,
    );

    fireEvent.click(screen.getByTestId("toggle-all-groups"));

    expect(onToggleAllGroups).toHaveBeenCalled();
  });

  it("折叠的分组不渲染其内容", () => {
    render(
      <SearchResultsList
        totalCount={1}
        groupCount={1}
        allGroupsCollapsed={true}
        onToggleAllGroups={vi.fn()}
        groups={[makeGroup("GroupA", 0, "xxx 01")]}
        collapsedGroups={new Set(["GroupA"])}
        onToggleGroup={vi.fn()}
        onCopyMagnet={vi.fn()}
        onPlay={vi.fn()}
        showBestAi={false}
      />,
    );

    expect(screen.queryByText("xxx 01")).not.toBeInTheDocument();
  });

  it("点击分组触发 onToggleGroup 并携带组名", () => {
    const onToggleGroup = vi.fn();
    render(
      <SearchResultsList
        totalCount={1}
        groupCount={1}
        allGroupsCollapsed={false}
        onToggleAllGroups={vi.fn()}
        groups={[makeGroup("GroupA", 0, "xxx 01")]}
        collapsedGroups={new Set()}
        onToggleGroup={onToggleGroup}
        onCopyMagnet={vi.fn()}
        onPlay={vi.fn()}
        showBestAi={false}
      />,
    );

    fireEvent.click(screen.getByTestId("group-trigger-GroupA"));

    expect(onToggleGroup).toHaveBeenCalledWith("GroupA");
  });
});
