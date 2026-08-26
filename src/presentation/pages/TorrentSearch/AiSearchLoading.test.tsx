import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AiSearchLoading } from "./AiSearchLoading";

describe("AiSearchLoading AI 搜索加载组件", () => {
  it("应该渲染 AI 搜索提示与取消按钮", () => {
    render(<AiSearchLoading onCancel={vi.fn()} />);

    expect(
      screen.getByText("AI 正在搜索，可能需要数秒，请稍候..."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "取消搜索" }),
    ).toBeInTheDocument();
  });

  it("点击取消按钮时调用 onCancel", () => {
    const onCancel = vi.fn();
    render(<AiSearchLoading onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "取消搜索" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
