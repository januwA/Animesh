/**
 * 背景壁纸位图预取：把榜单封面一次性加载并预模糊到小尺寸离屏 canvas，
 * 后续动画循环只做低成本 drawImage，避免页面出现加载/解码卡顿。
 *
 * 注意：bangumi 图床（lain.bgm.tv）不返回 CORS 头，不能用 fetch + createImageBitmap；
 * 这里用普通 Image 加载（canvas 会被标记 tainted，但我们从不读取像素，drawImage 不受影响）。
 */
export interface BackgroundImage {
  canvas: HTMLCanvasElement;
  aspect: number;
}

/** 预模糊半径（相对预览高度，保证不同来源分辨率在屏幕上呈现一致的柔和度） */
const BLUR_HEIGHT_RATIO = 0.003;
/** 预模糊后小图的最大高度，兼顾清晰度与性能 */
const MAX_PREVIEW_HEIGHT = 480;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function blurToCanvas(img: HTMLImageElement): BackgroundImage {
  const scale = Math.min(1, MAX_PREVIEW_HEIGHT / img.naturalHeight);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.filter = `blur(${Math.max(1, Math.round(height * BLUR_HEIGHT_RATIO))}px)`;
    ctx.drawImage(img, 0, 0, width, height);
  }
  return { canvas, aspect: width / height };
}

/** 逐个加载图片并预模糊，加载失败的图片静默跳过。 */
export async function preloadBackgroundImages(
  urls: string[],
): Promise<BackgroundImage[]> {
  const images: BackgroundImage[] = [];
  for (const url of urls) {
    const img = await loadImage(url);
    if (!img) continue;
    images.push(blurToCanvas(img));
  }
  return images;
}
