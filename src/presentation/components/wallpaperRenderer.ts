import { Duration } from "ajanuw-duration";

/** 背景壁纸待绘制的图片源（预模糊离屏 canvas） */
export interface WallpaperImage {
  canvas: HTMLCanvasElement;
}

/** 单张封面完整展示的时长（毫秒） */
export const WALLPAPER_DURATION_MS = new Duration({ seconds: 60 })
  .inMilliseconds;
/** 交叉淡入淡出占整个周期的比例，其余时间保持单张清晰展示 */
export const FADE_DURATION_RATIO = 0.1;

const TAU = Math.PI * 2;

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * 渲染一帧 Ken Burns 交叉淡入淡出：
 * - 上一张持续轻微缩放/平移并淡出，下一张淡入；
 * - 由 elapsedMs 决定当前循环位置，全程确定性，便于测试。
 */
export function renderWallpaperFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  images: WallpaperImage[],
  elapsedMs: number,
): void {
  ctx.clearRect(0, 0, width, height);
  // v8 ignore next
  if (images.length === 0) return;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const cycle = Math.floor(elapsedMs / WALLPAPER_DURATION_MS);
  const progress =
    (elapsedMs - cycle * WALLPAPER_DURATION_MS) / WALLPAPER_DURATION_MS;
  const fromIndex = cycle % images.length;
  const toIndex = (fromIndex + 1) % images.length;
  const fadeStart = 1 - FADE_DURATION_RATIO;
  const fadeProgress = Math.max(
    0,
    (progress - fadeStart) / FADE_DURATION_RATIO,
  );
  const fade = easeInOut(Math.min(fadeProgress, 1));

  const fromAlpha = 1 - fade;
  // v8 ignore next
  if (fromAlpha > 0)
    drawLayer(ctx, width, height, images[fromIndex], progress, fromAlpha);
  if (fade > 0) drawLayer(ctx, width, height, images[toIndex], progress, fade);
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  image: WallpaperImage,
  progress: number,
  alpha: number,
): void {
  const zoom = 1.05 + 0.1 * (0.5 - 0.5 * Math.cos(progress * TAU));
  const scale =
    Math.max(width / image.canvas.width, height / image.canvas.height) * zoom;
  const drawWidth = image.canvas.width * scale;
  const drawHeight = image.canvas.height * scale;

  const availX = Math.max(0, (drawWidth - width) / 2);
  const availY = Math.max(0, (drawHeight - height) / 2);

  const panRatio = 0.6;
  const angle = progress * TAU;
  const panX = Math.sin(angle) * availX * panRatio;
  const panY = Math.cos(angle) * availY * panRatio;

  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.drawImage(
    image.canvas,
    (width - drawWidth) / 2 + panX,
    (height - drawHeight) / 2 + panY,
    drawWidth,
    drawHeight,
  );
  ctx.globalAlpha = prevAlpha;
}
