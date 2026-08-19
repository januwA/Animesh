import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SearchLoading } from "./SearchLoading";

describe("SearchLoading 传统搜索加载组件", () => {
  it("应该渲染加载提示与取消按钮", () => {
    render(<SearchLoading onCancel={vi.fn()} />);

    expect(screen.getByText("正在获取资源列表...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "取消搜索" }),
    ).toBeInTheDocument();
  });

  it("点击取消按钮时调用 onCancel", () => {
    const onCancel = vi.fn();
    render(<SearchLoading onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "取消搜索" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
