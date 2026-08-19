import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ConfirmLeaveDialog } from "./ConfirmLeaveDialog";

const makeProps = (
  overrides: Partial<Parameters<typeof ConfirmLeaveDialog>[0]> = {},
) => ({
  open: true,
  onOpenChange: vi.fn(),
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
  ...overrides,
});

describe("ConfirmLeaveDialog 离开确认对话框", () => {
  it("打开时应该渲染提示与操作按钮", () => {
    render(<ConfirmLeaveDialog {...makeProps()} />);

    expect(screen.getByText("放弃未保存的更改？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "确认离开" }),
    ).toBeInTheDocument();
  });

  it("点击取消时应该触发 onCancel", () => {
    const props = makeProps();
    render(<ConfirmLeaveDialog {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(props.onCancel).toHaveBeenCalled();
  });

  it("点击确认离开时应该触发 onConfirm", () => {
    const props = makeProps();
    render(<ConfirmLeaveDialog {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "确认离开" }));

    expect(props.onConfirm).toHaveBeenCalled();
  });

  it("关闭时不应该渲染对话框内容", () => {
    render(<ConfirmLeaveDialog {...makeProps({ open: false })} />);

    expect(screen.queryByText("放弃未保存的更改？")).not.toBeInTheDocument();
  });
});
