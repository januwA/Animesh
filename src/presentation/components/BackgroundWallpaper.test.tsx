import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DIContext } from "@/di/DIContext";
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeDIContainer(executeMock: (...args: any[]) => any) {
  return {
    getWallpaperImagesUseCase: { execute: executeMock },
  } as any;
}

function renderWithDI(executeMock: (...args: any[]) => any) {
  return render(
    <DIContext value={makeDIContainer(executeMock)}>
      <BackgroundWallpaper />
    </DIContext>,
  );
}

describe("BackgroundWallpaper 背景壁纸组件", () => {
  it("query 无数据时渲染 null", async () => {
    const execute = vi.fn().mockResolvedValue(null);
    const { container } = renderWithDI(execute);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("query 返回空图片列表时渲染 null", async () => {
    const execute = vi.fn().mockResolvedValue([{ id: 1, name: "", image: "" }]);
    const { container } = renderWithDI(execute);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("query 返回有效图片时渲染壁纸容器和遮罩层", async () => {
    const execute = vi.fn().mockResolvedValue([
      { id: 1, name: "A", image: "https://img.example/1.jpg" },
      { id: 2, name: "B", image: "https://img.example/2.jpg" },
    ]);

    const { container } = renderWithDI(execute);

    await waitFor(() => {
      const root = container.querySelector('[aria-hidden="true"]');
      expect(root).not.toBeNull();
      expect(root?.className).toContain("fixed");
      expect(root?.className).toContain("z-0");
      expect(root?.querySelector(".absolute.inset-0")).not.toBeNull();
    });
  });

  it("有效图片时渲染包含 PixiJS 容器和遮罩层的完整结构", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue([
        { id: 1, name: "A", image: "https://img.example/1.jpg" },
      ]);

    const { container } = renderWithDI(execute);

    await waitFor(() => {
      const root = container.querySelector('[aria-hidden="true"]');
      expect(root).not.toBeNull();
      expect(root?.children.length).toBe(2);
      expect(root?.children[0]).toBeInstanceOf(HTMLDivElement);
      expect(root?.children[1]).toBeInstanceOf(HTMLDivElement);
    });
  });
});
