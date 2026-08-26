import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ErrorState } from "./ErrorState";

describe("ErrorState 错误提示组件", () => {
  it("应该渲染默认标题与 Error 格式化后的信息", () => {
    render(
      <ErrorState message={new Error("网络请求超时")} onRetry={vi.fn()} />,
    );

    expect(screen.getByText("加载失败")).toBeInTheDocument();
    expect(screen.getByText("网络请求超时")).toBeInTheDocument();
  });

  it("应该渲染自定义标题与字符串错误信息", () => {
    render(<ErrorState message="boom" title="自定义标题" onRetry={vi.fn()} />);

    expect(screen.getByText("自定义标题")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("点击重试按钮时应该调用 onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="boom" onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(onRetry).toHaveBeenCalled();
  });
});
