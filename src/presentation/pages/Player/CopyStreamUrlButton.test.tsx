import { fireEvent, render, screen, within } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { CopyStreamUrlButton } from "./CopyStreamUrlButton";

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn() },
  writable: true,
});

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <svg data-testid="qr-code" data-value={value} />
  ),
}));

describe("CopyStreamUrlButton 复制流地址按钮组件", () => {
  it("应该渲染复制按钮", () => {
    render(<CopyStreamUrlButton streamUrl="http://127.0.0.1/stream/0" />);

    expect(
      screen.getByRole("button", { name: "复制视频流地址" }),
    ).toBeInTheDocument();
  });

  it("流地址为空时按钮应该禁用", () => {
    render(<CopyStreamUrlButton streamUrl={null} />);

    expect(
      screen.getByRole("button", { name: "复制视频流地址" }),
    ).toBeDisabled();
  });

  it("点击按钮应该打开弹窗", async () => {
    render(<CopyStreamUrlButton streamUrl="http://127.0.0.1/stream/0" />);

    await fireEvent.click(
      screen.getByRole("button", { name: "复制视频流地址" }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("视频流地址")).toBeInTheDocument();
    expect(
      screen.getByText("扫描二维码或点击复制按钮获取流地址"),
    ).toBeInTheDocument();
  });

  it("弹窗内应该显示二维码", async () => {
    render(<CopyStreamUrlButton streamUrl="http://127.0.0.1/stream/0" />);

    await fireEvent.click(
      screen.getByRole("button", { name: "复制视频流地址" }),
    );

    const dialog = screen.getByRole("dialog");
    const qrCode = within(dialog).getByTestId("qr-code");
    expect(qrCode).toBeInTheDocument();
    expect(qrCode).toHaveAttribute("data-value", "http://127.0.0.1/stream/0");
  });

  it("弹窗内复制按钮应该能复制地址", async () => {
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
    render(<CopyStreamUrlButton streamUrl="http://127.0.0.1/stream/0" />);

    await fireEvent.click(
      screen.getByRole("button", { name: "复制视频流地址" }),
    );

    const dialog = screen.getByRole("dialog");
    await fireEvent.click(within(dialog).getByRole("button", { name: "复制" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "http://127.0.0.1/stream/0",
    );
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "视频流地址已复制到剪贴板，可在外部播放器中播放",
    );
  });

  it("弹窗内复制失败时应该提示失败", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("clipboard blocked"),
    );
    render(<CopyStreamUrlButton streamUrl="http://127.0.0.1/stream/0" />);

    await fireEvent.click(
      screen.getByRole("button", { name: "复制视频流地址" }),
    );

    const dialog = screen.getByRole("dialog");
    await fireEvent.click(within(dialog).getByRole("button", { name: "复制" }));

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("复制失败，请手动复制");
  });
});
