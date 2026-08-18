import { fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { CopyStreamUrlButton } from "./CopyStreamUrlButton";

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn() },
  writable: true,
});

describe("CopyStreamUrlButton 复制流地址按钮组件", () => {
  it("应该渲染复制按钮", () => {
    render(<CopyStreamUrlButton streamUrl="http://127.0.0.1/stream/0" />);

    expect(
      screen.getByRole("button", { name: "复制视频流地址" }),
    ).toBeInTheDocument();
  });

  it("流地址为空时点击不应该调用剪贴板", async () => {
    render(<CopyStreamUrlButton streamUrl={null} />);

    await fireEvent.click(
      screen.getByRole("button", { name: "复制视频流地址" }),
    );

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("复制成功时应该提示成功", async () => {
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
    render(<CopyStreamUrlButton streamUrl="http://127.0.0.1/stream/0" />);

    await fireEvent.click(
      screen.getByRole("button", { name: "复制视频流地址" }),
    );

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "http://127.0.0.1/stream/0",
    );
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "视频流地址已复制到剪贴板，可在外部播放器中播放",
    );
  });

  it("复制失败时应该提示失败", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("clipboard blocked"),
    );
    render(<CopyStreamUrlButton streamUrl="http://127.0.0.1/stream/0" />);

    await fireEvent.click(
      screen.getByRole("button", { name: "复制视频流地址" }),
    );

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("复制失败，请手动复制");
  });
});
