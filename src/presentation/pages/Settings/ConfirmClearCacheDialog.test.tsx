import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ConfirmClearCacheDialog } from "./ConfirmClearCacheDialog";

const makeProps = (
  overrides: Partial<Parameters<typeof ConfirmClearCacheDialog>[0]> = {},
) => ({
  open: true,
  clearingCache: false,
  onOpenChange: vi.fn(),
  onConfirm: vi.fn(),
  ...overrides,
});

describe("ConfirmClearCacheDialog 清理缓存确认对话框", () => {
  it("打开时应该渲染提示与操作按钮", () => {
    render(<ConfirmClearCacheDialog {...makeProps()} />);

    expect(screen.getByText("确定清理缓存数据？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "确认清理" }),
    ).toBeInTheDocument();
  });

  it("点击取消时应该触发 onOpenChange(false)", () => {
    const props = makeProps();
    render(<ConfirmClearCacheDialog {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("点击确认清理时应该触发 onConfirm", () => {
    const props = makeProps();
    render(<ConfirmClearCacheDialog {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "确认清理" }));

    expect(props.onConfirm).toHaveBeenCalled();
  });

  it("清理中时确认按钮应该禁用并显示清理中", () => {
    render(<ConfirmClearCacheDialog {...makeProps({ clearingCache: true })} />);

    expect(screen.getByRole("button", { name: "清理中..." })).toBeDisabled();
  });

  it("关闭时不应该渲染对话框内容", () => {
    render(<ConfirmClearCacheDialog {...makeProps({ open: false })} />);

    expect(screen.queryByText("确定清理缓存数据？")).not.toBeInTheDocument();
  });
});
