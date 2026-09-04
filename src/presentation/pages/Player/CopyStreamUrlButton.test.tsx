import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { CopyStreamUrlButton } from "./CopyStreamUrlButton";

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn() },
  writable: true,
  configurable: true,
});

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <svg data-testid="qr-code" data-value={value} />
  ),
}));

vi.mock(import("@/presentation/context/StreamServerContext"), () => ({
  useStreamServer: () => ({ streamPort: 45678 }),
}));

const mockGetLocalIpUseCase = {
  execute: vi.fn().mockResolvedValue("192.168.1.100"),
};

describe("CopyStreamUrlButton 复制流地址按钮组件", () => {
  it("应该渲染复制按钮", () => {
    render(
      <CopyStreamUrlButton
        infoHash="abc123"
        fileId={0}
        getLocalIpUseCase={mockGetLocalIpUseCase}
      />,
    );

    expect(
      screen.getByRole("button", { name: "复制视频流地址" }),
    ).toBeInTheDocument();
  });

  it("点击按钮应该打开弹窗并加载分享地址", async () => {
    const user = userEvent.setup();
    render(
      <CopyStreamUrlButton
        infoHash="abc123"
        fileId={0}
        getLocalIpUseCase={mockGetLocalIpUseCase}
      />,
    );

    await user.click(screen.getByRole("button", { name: "复制视频流地址" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    expect(screen.getByText("视频流地址")).toBeInTheDocument();
    expect(
      screen.getByText("扫描二维码或点击复制按钮获取流地址"),
    ).toBeInTheDocument();
  });

  it("弹窗内应该显示二维码并使用局域网地址", async () => {
    const user = userEvent.setup();
    render(
      <CopyStreamUrlButton
        infoHash="abc123"
        fileId={0}
        getLocalIpUseCase={mockGetLocalIpUseCase}
      />,
    );

    await user.click(screen.getByRole("button", { name: "复制视频流地址" }));

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      const qrCode = within(dialog).getByTestId("qr-code");
      expect(qrCode).toHaveAttribute(
        "data-value",
        "http://192.168.1.100:45678/stream/abc123/0",
      );
    });
  });

  it("弹窗内复制按钮应该能复制地址", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(
      undefined as never,
    );
    render(
      <CopyStreamUrlButton
        infoHash="abc123"
        fileId={0}
        getLocalIpUseCase={mockGetLocalIpUseCase}
      />,
    );

    await user.click(screen.getByRole("button", { name: "复制视频流地址" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "复制" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "http://192.168.1.100:45678/stream/abc123/0",
    );
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "视频流地址已复制到剪贴板，可在外部播放器中播放",
    );
  });

  it("弹窗内复制失败时应该提示失败", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("clipboard blocked"),
    );
    render(
      <CopyStreamUrlButton
        infoHash="abc123"
        fileId={0}
        getLocalIpUseCase={mockGetLocalIpUseCase}
      />,
    );

    await user.click(screen.getByRole("button", { name: "复制视频流地址" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "复制" }));

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("复制失败，请手动复制");
  });

  it("关闭弹窗时不应该重复请求地址", async () => {
    const user = userEvent.setup();
    mockGetLocalIpUseCase.execute.mockClear();
    render(
      <CopyStreamUrlButton
        infoHash="abc123"
        fileId={0}
        getLocalIpUseCase={mockGetLocalIpUseCase}
      />,
    );

    await user.click(screen.getByRole("button", { name: "复制视频流地址" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    expect(mockGetLocalIpUseCase.execute).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(mockGetLocalIpUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it("再次打开弹窗时不应该重复请求地址", async () => {
    const user = userEvent.setup();
    mockGetLocalIpUseCase.execute.mockClear();
    render(
      <CopyStreamUrlButton
        infoHash="abc123"
        fileId={0}
        getLocalIpUseCase={mockGetLocalIpUseCase}
      />,
    );

    await user.click(screen.getByRole("button", { name: "复制视频流地址" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    expect(mockGetLocalIpUseCase.execute).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "复制视频流地址" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    expect(mockGetLocalIpUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it("获取局域网地址失败时应该提示错误", async () => {
    const user = userEvent.setup();
    mockGetLocalIpUseCase.execute.mockRejectedValueOnce(
      new Error("network error"),
    );
    render(
      <CopyStreamUrlButton
        infoHash="abc123"
        fileId={0}
        getLocalIpUseCase={mockGetLocalIpUseCase}
      />,
    );

    await user.click(screen.getByRole("button", { name: "复制视频流地址" }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("获取局域网地址失败");
    });
  });
});
