import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LivePlayerView } from "./LivePlayerView";

const mockDeps = {
  resolvePlayableStreamUrlUseCase: {
    execute: vi.fn().mockResolvedValue({
      url: "http://proxied.example.com/live.m3u8",
      kind: "hls",
    }),
  },
  logger: {
    withCategory: () => ({
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      withCategory: vi.fn(),
    }),
  },
};

const renderLivePlayerView = (
  overrides: Partial<Parameters<typeof LivePlayerView>[0]> = {},
) => {
  const props = {
    url: "http://example.com/live.m3u8",
    name: "CCTV-1",
    logo: "http://example.com/logo.png",
    category: "新闻",
    deps: mockDeps,
    ...overrides,
  };
  const router = createMemoryRouter([
    { path: "/", element: <LivePlayerView {...props} /> },
  ]);
  return render(<RouterProvider router={router} />);
};

describe("LivePlayerView 直播播放器视图组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    (globalThis as any).__vjsMock.setError(null);
  });

  it("应该渲染频道名称和分类", async () => {
    renderLivePlayerView();

    await waitFor(() => {
      expect(screen.getByText("CCTV-1")).toBeInTheDocument();
    });
    expect(screen.getByText("新闻")).toBeInTheDocument();
    expect(screen.getByText("直播")).toBeInTheDocument();
  });

  it("没有 logo 时不应该渲染 logo 图片", async () => {
    renderLivePlayerView({ logo: "" });

    await waitFor(() => {
      expect(screen.getByText("CCTV-1")).toBeInTheDocument();
    });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("name 为空时应该显示未命名频道", async () => {
    renderLivePlayerView({ name: "" });

    await waitFor(() => {
      expect(screen.getByText("未命名频道")).toBeInTheDocument();
    });
  });

  it("解析直播源失败时应该回退到原始地址继续播放", async () => {
    const failingDeps = {
      ...mockDeps,
      resolvePlayableStreamUrlUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("解析失败")),
      },
    };
    renderLivePlayerView({ deps: failingDeps });

    await waitFor(() => {
      expect(document.querySelector("video")).not.toBeNull();
    });
  });

  it("解析为 FLV 流时应该渲染 FLV 播放器", async () => {
    const flvDeps = {
      ...mockDeps,
      resolvePlayableStreamUrlUseCase: {
        execute: vi.fn().mockResolvedValue({
          url: "http://example.com/live.flv",
          kind: "flv",
        }),
      },
    };
    renderLivePlayerView({ deps: flvDeps });

    await waitFor(() => {
      expect(screen.getByText("CCTV-1")).toBeInTheDocument();
    });
    expect(document.querySelector("video")).not.toBeNull();
  });

  it("直播流错误 code 2 时应该自动重连并提示", async () => {
    renderLivePlayerView();

    await waitFor(() => {
      expect(document.querySelector("video")).not.toBeNull();
    });

    const vjsMock = (globalThis as any).__vjsMock;
    act(() => {
      vjsMock.setError({ code: 2 } as MediaError);
      vjsMock.trigger();
    });

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        "直播流中断，正在自动重连...",
      );
    });
  });

  it("重连次数达到上限后应该停止自动重连", async () => {
    renderLivePlayerView();

    await waitFor(() => {
      expect(document.querySelector("video")).not.toBeNull();
    });

    const vjsMock = (globalThis as any).__vjsMock;
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        vjsMock.setError({ code: 3 } as MediaError);
        vjsMock.trigger();
      });
    }

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledTimes(5);
    });
  });

  it("点击复制按钮时应该复制原始直播源地址", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    renderLivePlayerView();

    await waitFor(() => {
      expect(screen.getByText("CCTV-1")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /复制/ }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        "http://example.com/live.m3u8",
      );
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "直播源地址已复制，可添加到代理规则中",
    );
  });

  it("复制失败时应该提示错误", async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    renderLivePlayerView();

    await waitFor(() => {
      expect(screen.getByText("CCTV-1")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /复制/ }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "复制失败，请手动复制",
      );
    });
  });
});
