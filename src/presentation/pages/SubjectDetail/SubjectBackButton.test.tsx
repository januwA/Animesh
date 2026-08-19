import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SubjectBackButton } from "./SubjectBackButton";

describe("SubjectBackButton 返回按钮组件", () => {
  it("应该渲染返回按钮", () => {
    render(<SubjectBackButton onBack={vi.fn()} />);

    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
  });

  it("点击时应该调用 onBack 回调", () => {
    const onBack = vi.fn();
    render(<SubjectBackButton onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
