/**
 * 背景壁纸位图预取：把榜单封面一次性加载并缩放到小尺寸离屏 canvas，
 * 后续动画循环只做低成本 drawImage，避免页面出现加载/解码卡顿。
 *
 * 注意：bangumi 图床（lain.bgm.tv）不返回 CORS 头，不能用 fetch + createImageBitmap；
 * 这里用普通 Image 加载（canvas 会被标记 tainted，但我们从不读取像素，drawImage 不受影响）。
 */
export interface BackgroundImage {
  canvas: HTMLCanvasElement;
}

/** 预览小图的最大高度，兼顾清晰度与性能 */
const MAX_PREVIEW_HEIGHT = 320;
/** 最大并发加载数，避免打满浏览器同域连接池（通常限制 6） */
const MAX_CONCURRENCY = 4;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function downscaleToCanvas(img: HTMLImageElement): BackgroundImage {
  const longSide = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = Math.min(1, MAX_PREVIEW_HEIGHT / longSide);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(img, 0, 0, width, height);
  }
  return { canvas };
}

/**
 * 分组并发执行：对 items 逐个以 maxConcurrency 并发调用 fn，
 * 保持结果顺序与输入一致，单个失败不影响其余。
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  maxConcurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = await fn(items[i]);
      } catch {
        // 单个失败由调用方处理（loadImage 已内部兜底返回 null）
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrency, items.length) },
    () => runNext(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * 分组并发加载图片并缩放到小尺寸，加载失败的图片静默跳过，保持原始顺序。
 * 最多同时发起 MAX_CONCURRENCY 个请求，避免打满浏览器连接池。
 */
export async function preloadBackgroundImages(
  urls: string[],
): Promise<BackgroundImage[]> {
  if (urls.length === 0) return [];

  const loaded = await mapWithConcurrency(urls, MAX_CONCURRENCY, loadImage);
  return loaded
    .filter((img): img is HTMLImageElement => img !== null)
    .map(downscaleToCanvas);
}
