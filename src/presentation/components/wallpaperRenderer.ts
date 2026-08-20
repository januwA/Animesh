import { Duration } from "ajanuw-duration";

/** 背景壁纸待绘制的图片源（预模糊离屏 canvas） */
export interface WallpaperImage {
  canvas: HTMLCanvasElement;
  aspect: number;
}

/** 单张封面完整展示的时长（毫秒） */
export const WALLPAPER_DURATION_MS = new Duration({ seconds: 15 })
  .inMilliseconds;
/** 交叉淡入淡出占整个周期的比例，其余时间保持单张清晰展示 */
export const FADE_DURATION_RATIO = 0.75;

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
  if (images.length === 0) return;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const cycle = Math.floor(elapsedMs / WALLPAPER_DURATION_MS);
  const progress =
    (elapsedMs - cycle * WALLPAPER_DURATION_MS) / WALLPAPER_DURATION_MS;
  const fromIndex = cycle % images.length;
  const toIndex = (fromIndex + 1) % images.length;
  const fade = easeInOut(Math.min(progress / FADE_DURATION_RATIO, 1));

  drawLayer(ctx, width, height, images[fromIndex], progress, 1 - fade);
  drawLayer(ctx, width, height, images[toIndex], progress, fade);
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  image: WallpaperImage,
  progress: number,
  alpha: number,
): void {
  if (alpha <= 0) return;

  // 连续周期缩放：progress=0 与 progress=1 处取值相同，避免周期切换瞬间缩放跳变造成卡顿
  const zoom = 1.08 + 0.08 * (0.5 - 0.5 * Math.cos(progress * Math.PI * 2));
  const scale =
    Math.max(width / image.canvas.width, height / image.canvas.height) * zoom;
  const drawWidth = image.canvas.width * scale;
  const drawHeight = image.canvas.height * scale;
  const panX = Math.sin(progress * Math.PI * 2) * width * 0.04;
  const panY = Math.cos(progress * Math.PI * 2) * height * 0.04;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(
    image.canvas,
    (width - drawWidth) / 2 + panX,
    (height - drawHeight) / 2 + panY,
    drawWidth,
    drawHeight,
  );
  ctx.restore();
}
