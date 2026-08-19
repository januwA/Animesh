import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
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

  it("应该渲染返回按钮", async () => {
    renderLivePlayerView();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /返回/ })).toBeInTheDocument();
    });
  });
});
