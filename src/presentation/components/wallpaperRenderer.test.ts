import { describe, expect, it } from "vitest";
import {
  easeInOut,
  FADE_DURATION_RATIO,
  renderWallpaperFrame,
  WALLPAPER_DURATION_MS,
} from "./wallpaperRenderer";

function createImage(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas };
}

function createRecordingCtx() {
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const ctx = {
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn((...args: unknown[]) =>
      calls.push({ op: "clearRect", args }),
    ),
    drawImage: vi.fn((...args: unknown[]) =>
      calls.push({ op: "drawImage", args }),
    ),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("renderWallpaperFrame 背景帧渲染", () => {
  it("空图片列表时仅清空画布", () => {
    const { ctx, calls } = createRecordingCtx();

    renderWallpaperFrame(ctx, 1920, 1080, [], 0);

    expect(calls).toEqual([{ op: "clearRect", args: [0, 0, 1920, 1080] }]);
  });

  it("起始时刻仅绘制当前图（淡出透明度为 0 被跳过）", () => {
    const images = [createImage(300, 400), createImage(600, 400)];
    const { ctx, calls } = createRecordingCtx();

    renderWallpaperFrame(ctx, 1920, 1080, images, 0);

    const draws = calls.filter((c) => c.op === "drawImage");
    expect(draws).toHaveLength(1);
    expect(draws[0].args[0]).toBe(images[0].canvas);
    expect(ctx.globalAlpha).toBe(1);
  });

  it("淡出阶段中途两张图以 0.5 透明度交叉绘制", () => {
    const images = [createImage(300, 400), createImage(600, 400)];
    const { ctx, calls } = createRecordingCtx();

    // progress = 0.95（淡出窗口中点：fadeStart + FADE_DURATION_RATIO/2）
    // fade = easeInOut(0.5) = 0.5
    renderWallpaperFrame(
      ctx,
      1920,
      1080,
      images,
      WALLPAPER_DURATION_MS * (1 - FADE_DURATION_RATIO / 2),
    );

    const draws = calls.filter((c) => c.op === "drawImage");
    expect(draws).toHaveLength(2);
  });

  it("淡出结束后进入下一周期，仅绘制下一张完整图片", () => {
    const images = [createImage(300, 400), createImage(600, 400)];
    const { ctx, calls } = createRecordingCtx();

    // 恰好一个周期结束：cycle=1, progress=0, fade=0，fromIndex=1
    renderWallpaperFrame(ctx, 1920, 1080, images, WALLPAPER_DURATION_MS);

    const draws = calls.filter((c) => c.op === "drawImage");
    expect(draws).toHaveLength(1);
    expect(draws[0].args[0]).toBe(images[1].canvas);
    expect(ctx.globalAlpha).toBe(1);
  });

  it("easeInOut 在 0.25 与 0.75 处分别覆盖两个分支", () => {
    expect(easeInOut(0.25)).toBeCloseTo(0.125);
    expect(easeInOut(0.75)).toBeCloseTo(0.875);
  });

  it("跨过周期后循环到下一组首尾图片", () => {
    const images = [
      createImage(300, 400),
      createImage(600, 400),
      createImage(500, 400),
    ];
    const { ctx, calls } = createRecordingCtx();

    // 第 2 个周期：fromIndex = 1，toIndex = 2
    renderWallpaperFrame(ctx, 1920, 1080, images, WALLPAPER_DURATION_MS * 2);

    const draws = calls.filter((c) => c.op === "drawImage");
    expect(draws).toHaveLength(1);
    expect(draws[0].args[0]).toBe(images[2].canvas);
  });

  it("周期边界处同一张图片的缩放应连续不跳变", () => {
    const images = [createImage(300, 400), createImage(600, 400)];

    const renderAt = (elapsedMs: number) => {
      const { ctx, calls } = createRecordingCtx();
      renderWallpaperFrame(ctx, 1920, 1080, images, elapsedMs);
      const draws = calls.filter((c) => c.op === "drawImage");
      // 周期末尾 fade≈1 时会绘制两张：fromIndex (alpha≈0) 和 toIndex (alpha≈1)
      // 我们需要取第二次 drawImage（toIndex，即即将展示的图片）
      return draws[draws.length - 1];
    };

    // 新逻辑：淡出发生在周期末尾 10%（progress 0.9~1.0）
    // 周期 0 末尾：cycle=0, progress≈1, fade≈1, fromIndex=0, toIndex=1 → toIndex 绘制 img[1]
    // 周期 1 开头：cycle=1, progress≈0, fade=0, fromIndex=1, toIndex=0 → fromIndex 绘制 img[1]
    // 两者都绘制 img[1]，缩放应连续
    const endOfCycle = renderAt(WALLPAPER_DURATION_MS - 1);
    const startOfNext = renderAt(WALLPAPER_DURATION_MS + 1);

    expect(endOfCycle.args[0]).toBe(images[1].canvas);
    expect(startOfNext.args[0]).toBe(images[1].canvas);
    // drawImage 的 dWidth 参数（args[3]）应几乎一致，避免缩放瞬间回退
    expect(
      Math.abs(Number(endOfCycle.args[3]) - Number(startOfNext.args[3])),
    ).toBeLessThan(0.01);
  });
});
