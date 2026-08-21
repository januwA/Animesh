import { Duration } from "ajanuw-duration";

/** 背景壁纸待绘制的图片源（预模糊离屏 canvas） */
export interface WallpaperImage {
  canvas: HTMLCanvasElement;
  aspect: number;
}

/** 单张封面完整展示的时长（毫秒） */
export const WALLPAPER_DURATION_MS = new Duration({ seconds: 60 })
  .inMilliseconds;
/** 交叉淡入淡出占整个周期的比例，其余时间保持单张清晰展示 */
export const FADE_DURATION_RATIO = 0.1;

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
  // drawLayer 或 renderWallpaperFrame 里加一层保护
  const fade =
    FADE_DURATION_RATIO > 0
      ? easeInOut(Math.min(progress / FADE_DURATION_RATIO, 1))
      : 1; // ratio 为 0 时视为无渐变，直接切换

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

  const zoom = 1.05 + 0.1 * (0.5 - 0.5 * Math.cos(progress * Math.PI * 2));
  const scale =
    Math.max(width / image.canvas.width, height / image.canvas.height) * zoom;
  const drawWidth = image.canvas.width * scale;
  const drawHeight = image.canvas.height * scale;

  // 安全平移范围(图片比画布多出的部分的一半)
  const availX = Math.max(0, (drawWidth - width) / 2);
  const availY = Math.max(0, (drawHeight - height) / 2);

  const panRatio = 0.6; // 留出安全余量,建议 0.5~0.8
  const angle = progress * Math.PI * 2;
  const panX = Math.sin(angle) * availX * panRatio;
  const panY = Math.cos(angle) * availY * panRatio;

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
