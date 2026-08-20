import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preloadBackgroundImages } from "./preloadBackgroundImages";

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 400;
  naturalHeight = 600;
  src = "";

  constructor() {
    queueMicrotask(() => {
      if (this.src.startsWith("bad:")) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    });
  }
}

function createFakeCtx() {
  return {
    filter: "",
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe("preloadBackgroundImages 图片预取", () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal("Image", FakeImage);
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
    getContextSpy.mockReturnValue(createFakeCtx());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("应逐个加载并预模糊图片，失败图片静默跳过", async () => {
    const images = await preloadBackgroundImages([
      "https://img.example/1.jpg",
      "bad://img.example/2.jpg",
      "https://img.example/3.jpg",
    ]);

    expect(images).toHaveLength(2);
    expect(images[0].canvas.width).toBeGreaterThan(0);
    expect(images[0].canvas.height).toBe(480);
    expect(images[0].aspect).toBeCloseTo(400 / 600);
    expect(getContextSpy).toHaveBeenCalledTimes(2);
  });

  it("空列表直接返回空数组", async () => {
    await expect(preloadBackgroundImages([])).resolves.toEqual([]);
  });

  it("getContext 不可用时仍返回占位 canvas 且不绘制", async () => {
    getContextSpy.mockReturnValue(null);

    const images = await preloadBackgroundImages(["https://img.example/1.jpg"]);

    expect(images).toHaveLength(1);
    expect(images[0].canvas.width).toBeGreaterThan(0);
  });
});
