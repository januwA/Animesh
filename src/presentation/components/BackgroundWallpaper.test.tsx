import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@/presentation/hooks/useQuery";
import { BackgroundWallpaper } from "./BackgroundWallpaper";

vi.mock("pixi.js", () => {
  const mockCanvas = document.createElement("canvas");
  const mockApp = {
    canvas: mockCanvas,
    screen: { width: 1920, height: 1080 },
    stage: { addChild: vi.fn() },
    ticker: {
      lastTime: 0,
      add: vi.fn(),
      stop: vi.fn(),
    },
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  };
  class MockApplication {
    canvas = mockApp.canvas;
    screen = mockApp.screen;
    stage = mockApp.stage;
    ticker = mockApp.ticker;
    init = mockApp.init;
    destroy = mockApp.destroy;
  }
  class MockSprite {
    anchor = { set: vi.fn() };
    alpha = 0;
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    destroy = vi.fn();
  }
  return {
    Application: MockApplication,
    Texture: { from: vi.fn(() => ({})) },
    Sprite: MockSprite,
  };
});

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    blob: vi.fn().mockResolvedValue(new Blob()),
  }),
);
vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({}));

const mockUseQuery = vi.mocked(useQuery);

const deps = { getBangumiRankedSubjectsUseCase: { execute: vi.fn() } };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BackgroundWallpaper 背景壁纸组件", () => {
  it("query 无数据时渲染 null", () => {
    mockUseQuery.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<BackgroundWallpaper deps={deps} />);
    expect(container.firstChild).toBeNull();
  });

  it("query 返回空图片列表时渲染 null", () => {
    mockUseQuery.mockReturnValue({
      data: [{ id: 1, name: "", image: "" }],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<BackgroundWallpaper deps={deps} />);
    expect(container.firstChild).toBeNull();
  });

  it("query 返回有效图片时渲染壁纸容器和遮罩层", () => {
    mockUseQuery.mockReturnValue({
      data: [
        { id: 1, name: "A", image: "https://img.example/1.jpg" },
        { id: 2, name: "B", image: "https://img.example/2.jpg" },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<BackgroundWallpaper deps={deps} />);

    const root = container.querySelector('[aria-hidden="true"]');
    expect(root).not.toBeNull();
    expect(root?.className).toContain("fixed");
    expect(root?.className).toContain("z-0");

    const pixiContainer = root?.querySelector(".absolute.inset-0");
    expect(pixiContainer).not.toBeNull();

    const overlay = root?.querySelector(".bg-background\\/70");
    expect(overlay).not.toBeNull();
  });

  it("遮罩层包含 transition-colors 样式", () => {
    mockUseQuery.mockReturnValue({
      data: [{ id: 1, name: "A", image: "https://img.example/1.jpg" }],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<BackgroundWallpaper deps={deps} />);

    const overlay = container.querySelector(".transition-colors");
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain("duration-300");
  });
});
