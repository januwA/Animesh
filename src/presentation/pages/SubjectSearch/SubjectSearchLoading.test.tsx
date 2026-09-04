import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SubjectSearchLoading } from "./SubjectSearchLoading";

describe("SubjectSearchLoading 搜索加载占位", () => {
  it("渲染骨架屏与加载提示", () => {
    render(<SubjectSearchLoading onCancel={() => {}} />);
    expect(screen.getByTestId("subject-search-loading")).toBeInTheDocument();
    expect(screen.getByText("正在搜索条目...")).toBeInTheDocument();
  });

  it("点击取消按钮触发 onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<SubjectSearchLoading onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "取消搜索" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
