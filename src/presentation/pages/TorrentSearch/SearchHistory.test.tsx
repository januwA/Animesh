import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SearchHistory } from "./SearchHistory";

const renderHistory = (
  history: string[],
  handlers: Partial<{
    onSelectKeyword: (keyword: string) => void;
    onDelete: (item: string) => void;
    onClear: () => void;
  }> = {},
) => {
  render(
    <SearchHistory
      history={history}
      onSelectKeyword={handlers.onSelectKeyword ?? vi.fn()}
      onDelete={handlers.onDelete ?? vi.fn()}
      onClear={handlers.onClear ?? vi.fn()}
    />,
  );
};

describe("SearchHistory 搜索历史组件", () => {
  it("历史为空时不渲染任何内容", () => {
    renderHistory([]);

    expect(screen.queryByText("最近搜索:")).not.toBeInTheDocument();
  });

  it("应该渲染历史关键词", () => {
    renderHistory(["xxx", "柯南"]);

    expect(screen.getByText("最近搜索:")).toBeInTheDocument();
    expect(screen.getByText("xxx")).toBeInTheDocument();
    expect(screen.getByText("柯南")).toBeInTheDocument();
  });

  it("点击关键词时调用 onSelectKeyword", () => {
    const onSelectKeyword = vi.fn();
    renderHistory(["xxx"], { onSelectKeyword });

    fireEvent.click(screen.getByText("xxx"));

    expect(onSelectKeyword).toHaveBeenCalledWith("xxx");
  });

  it("点击删除按钮时调用 onDelete 且不触发选中", () => {
    const onSelectKeyword = vi.fn();
    const onDelete = vi.fn();
    renderHistory(["xxx"], { onSelectKeyword, onDelete });

    fireEvent.click(screen.getByTestId("delete-history-xxx"));

    expect(onDelete).toHaveBeenCalledWith("xxx");
    expect(onSelectKeyword).not.toHaveBeenCalled();
  });

  it("点击清空按钮时调用 onClear", () => {
    const onClear = vi.fn();
    renderHistory(["xxx", "柯南"], { onClear });

    fireEvent.click(screen.getByRole("button", { name: "清空" }));

    expect(onClear).toHaveBeenCalled();
  });
});
