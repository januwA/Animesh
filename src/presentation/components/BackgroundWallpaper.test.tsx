import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBackgroundWallpaper } from "@/presentation/hooks/useBackgroundWallpaper";
import { BackgroundWallpaper } from "./BackgroundWallpaper";

vi.mock("@/presentation/hooks/useBackgroundWallpaper", () => ({
  useBackgroundWallpaper: vi.fn(),
}));

const mockHook = vi.mocked(useBackgroundWallpaper);

const deps = { getBangumiRankedSubjectsUseCase: { execute: vi.fn() } };

function createImageCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function renderCanvasCtx() {
  const ctx = {
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  };
  const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
  spy.mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  return { ctx, spy };
}

function stubRaf() {
  let callback: FrameRequestCallback | null = null;
  let rafId = 0;
  const raf = vi.fn((cb: FrameRequestCallback) => {
    callback = cb;
    return ++rafId;
  });
  const cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  return {
    raf,
    cancel,
    tick: (time: number) => {
      const cb = callback;
      callback = null;
      cb?.(time);
    },
  };
}

function stubReducedMotion(matches: boolean) {
  const mq = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mq),
  );
  return mq;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, "devicePixelRatio", {
    value: 1,
    configurable: true,
  });
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
});

describe("BackgroundWallpaper 背景壁纸组件", () => {
  it("status 非 ready 时渲染 null", () => {
    mockHook.mockReturnValue({ status: "loading", images: [] });
    const { container } = render(<BackgroundWallpaper deps={deps} />);
    expect(container.firstChild).toBeNull();
  });

  it("ready 但图片为空时渲染 null", () => {
    mockHook.mockReturnValue({ status: "ready", images: [] });
    const { container } = render(<BackgroundWallpaper deps={deps} />);
    expect(container.firstChild).toBeNull();
  });

  it("ready 时渲染画布与语义遮罩层", () => {
    mockHook.mockReturnValue({
      status: "ready",
      images: [
        { canvas: createImageCanvas(300, 400) },
        { canvas: createImageCanvas(600, 400) },
      ],
    });
    renderCanvasCtx();

    const { container } = render(<BackgroundWallpaper deps={deps} />);

    expect(container.querySelector("canvas")).not.toBeNull();
    const layer = container.querySelector('[aria-hidden="true"]');
    expect(layer).not.toBeNull();
    expect(layer?.className).toContain("fixed");
    expect(layer?.className).toContain("z-0");
  });

  it("启用动画时通过 RAF 循环渲染帧，卸载后取消循环", () => {
    const { raf, cancel, tick } = stubRaf();
    const { ctx } = renderCanvasCtx();
    mockHook.mockReturnValue({
      status: "ready",
      images: [{ canvas: createImageCanvas(300, 400) }],
    });

    const { unmount } = render(<BackgroundWallpaper deps={deps} />);

    expect(raf).toHaveBeenCalledTimes(1);
    tick(1000);
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();

    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("首个 RAF 时间戳早于 performance.now 时也不会崩溃", () => {
    const { tick } = stubRaf();
    const { ctx } = renderCanvasCtx();
    vi.spyOn(performance, "now").mockReturnValue(1000);
    mockHook.mockReturnValue({
      status: "ready",
      images: [{ canvas: createImageCanvas(300, 400) }],
    });

    const { container } = render(<BackgroundWallpaper deps={deps} />);

    expect(() => tick(0)).not.toThrow();
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("以首个 RAF 时间戳为基准持续推进动画", () => {
    const { tick } = stubRaf();
    const { ctx } = renderCanvasCtx();
    mockHook.mockReturnValue({
      status: "ready",
      images: [
        { canvas: createImageCanvas(300, 400) },
        { canvas: createImageCanvas(600, 400) },
      ],
    });

    const { unmount } = render(<BackgroundWallpaper deps={deps} />);

    tick(100);
    const firstDraws = ctx.drawImage.mock.calls.length;
    tick(200);

    expect(ctx.drawImage.mock.calls.length).toBeGreaterThan(firstDraws);
    unmount();
  });

  it("用户偏好减少动态时只渲染静态一帧", () => {
    const { raf } = stubRaf();
    const { ctx } = renderCanvasCtx();
    stubReducedMotion(true);
    mockHook.mockReturnValue({
      status: "ready",
      images: [{ canvas: createImageCanvas(300, 400) }],
    });

    const { container } = render(<BackgroundWallpaper deps={deps} />);

    expect(container.querySelector("canvas")).not.toBeNull();
    expect(raf).not.toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("devicePixelRatio 不可用时回退为 1 计算画布尺寸", () => {
    stubRaf();
    renderCanvasCtx();
    Object.defineProperty(window, "devicePixelRatio", {
      value: 0,
      configurable: true,
    });
    mockHook.mockReturnValue({
      status: "ready",
      images: [{ canvas: createImageCanvas(300, 400) }],
    });

    const { container } = render(<BackgroundWallpaper deps={deps} />);

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
  });

  it("页面隐藏时跳过绘制但保持循环", () => {
    const { raf, cancel, tick } = stubRaf();
    const { ctx } = renderCanvasCtx();
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    mockHook.mockReturnValue({
      status: "ready",
      images: [{ canvas: createImageCanvas(300, 400) }],
    });

    const { unmount } = render(<BackgroundWallpaper deps={deps} />);

    tick(1000);
    expect(ctx.clearRect).not.toHaveBeenCalled();
    expect(raf.mock.calls.length).toBeGreaterThan(1);

    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("getContext 不可用时静默跳过绘制", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    mockHook.mockReturnValue({
      status: "ready",
      images: [{ canvas: createImageCanvas(300, 400) }],
    });

    const { container } = render(<BackgroundWallpaper deps={deps} />);

    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
