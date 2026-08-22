import { Application, Sprite, Texture, type Ticker } from "pixi.js";
import { useEffect, useMemo, useRef } from "react";
import type { GetBangumiRankedSubjectsUseCase } from "@/application/bangumi/GetBangumiRankedSubjectsUseCase";
import { useQuery } from "@/presentation/hooks/useQuery";

export interface BackgroundWallpaperDeps {
  getBangumiRankedSubjectsUseCase: Pick<
    GetBangumiRankedSubjectsUseCase,
    "execute"
  >;
}

export interface BackgroundWallpaperProps {
  deps: BackgroundWallpaperDeps;
}

const TAU = Math.PI * 2;
const WALLPAPER_DURATION_MS = 60_000;
const FADE_DURATION_RATIO = 0.1;
// 背景图不需要原图分辨率，超过这个长边就等比例缩小，减少解码/显存开销
const MAX_TEXTURE_DIMENSION = 480;
// 慢速运镜不需要跟随屏幕刷新率，限帧可以省下大量 GPU/CPU
const TARGET_FPS = 30;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * 全局背景壁纸：使用 PixiJS (WebGL) 渲染 Ken Burns 交叉淡入淡出。
 */
export function BackgroundWallpaper({ deps }: BackgroundWallpaperProps) {
  const { getBangumiRankedSubjectsUseCase } = deps;

  const { data: subjects } = useQuery(
    (ctx) => getBangumiRankedSubjectsUseCase.execute(ctx),
    [getBangumiRankedSubjectsUseCase],
  );

  const rawImages = useMemo(() => {
    if (!subjects) return [];
    return [
      ...new Set(
        subjects
          .map((subject) => subject.image)
          .filter((url) => url.length > 0),
      ),
    ];
  }, [subjects]);

  // 用内容而非引用做 key：即使 useQuery 返回了新的数组引用，
  // 只要图片列表内容没变，就不重建 PixiJS Application / 不重新下载图片。
  const imagesKey = rawImages.join("|");
  const imagesRef = useRef<string[]>(rawImages);
  if (imagesRef.current.join("|") !== imagesKey) {
    imagesRef.current = rawImages;
  }
  const images = imagesRef.current;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (images.length === 0) return;
    const parent = containerRef.current;
    if (!parent) return;

    let destroyed = false;
    const sprites: Sprite[] = [];
    const abortController = new AbortController();

    const app = new Application();

    const loadBitmap = async (url: string): Promise<ImageBitmap | null> => {
      try {
        const blob = await fetch(url, { signal: abortController.signal }).then(
          (r) => r.blob(),
        );
        // 先按原始尺寸解码一次拿到真实宽高。
        // 不能凭空指定一个目标框去 resize —— 如果同时指定 resizeWidth
        // 和 resizeHeight，createImageBitmap 会强制把图片压/拉伸到那个
        // 框里而不保持宽高比，导致画面变形。
        const original = await createImageBitmap(blob);
        const longSide = Math.max(original.width, original.height);
        if (longSide <= MAX_TEXTURE_DIMENSION) {
          return original;
        }
        // 只有超过尺寸上限时才等比例缩小
        const ratio = MAX_TEXTURE_DIMENSION / longSide;
        const resized = await createImageBitmap(original, {
          resizeWidth: Math.round(original.width * ratio),
          resizeHeight: Math.round(original.height * ratio),
          resizeQuality: "medium",
        }).catch(() => original);
        if (resized !== original) {
          original.close();
        }
        return resized;
      } catch {
        return null;
      }
    };

    const initApp = async () => {
      await app.init({
        resizeTo: parent,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(2, window.devicePixelRatio),
        autoDensity: true,
      });
      if (destroyed) {
        app.destroy();
        return;
      }

      app.ticker.maxFPS = TARGET_FPS;

      parent.insertBefore(app.canvas as HTMLCanvasElement, parent.firstChild);

      // 并行加载所有图片，而不是逐张 await —— 大幅缩短首次可见动画的等待时间
      const bitmaps = await Promise.all(images.map(loadBitmap));
      if (destroyed) return;

      for (const bitmap of bitmaps) {
        if (!bitmap) continue;
        const texture = Texture.from(bitmap);
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.alpha = 0;
        sprite.visible = false;
        sprites.push(sprite);
        app.stage.addChild(sprite);
        // 注意：这里不能调用 bitmap.close()。Pixi 的 GPU 上传是惰性的，
        // 要等到第一次渲染这个纹理时才真正读取 ImageBitmap 的像素数据；
        // 提前 close() 会导致上传时读到空数据，表现为贴图不显示且不报错。
      }

      if (sprites.length === 0) return;

      const prefersReducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        const { width, height } = app.screen;
        for (const s of sprites) {
          s.x = width / 2;
          s.y = height / 2;
          s.scale.set(coverScale(s, width, height));
        }
        sprites[0].alpha = 1;
        sprites[0].visible = true;
        return;
      }

      // 每个精灵的“覆盖屏幕”基础缩放值只在屏幕尺寸变化时才需要重算，
      // 缓存起来避免每帧都对每张贴图重复做除法
      const baseScaleCache = new Map<Sprite, number>();
      let cachedWidth = -1;
      let cachedHeight = -1;

      const refreshBaseScales = (width: number, height: number) => {
        if (width === cachedWidth && height === cachedHeight) return;
        cachedWidth = width;
        cachedHeight = height;
        for (const s of sprites) {
          baseScaleCache.set(s, coverScale(s, width, height));
        }
      };

      let startTime: number | null = null;

      const animate = (ticker: Ticker) => {
        if (destroyed || sprites.length === 0) return;

        const now = ticker.lastTime;
        if (startTime === null) startTime = now;
        const elapsed = now - startTime;

        const { width, height } = app.screen;
        refreshBaseScales(width, height);

        // 用实际加载成功的张数计算周期，避免因个别图片加载失败
        // 导致 currentIdx 越界访问 sprites 数组
        const totalCycle = sprites.length * WALLPAPER_DURATION_MS;
        const cyclePos = elapsed % totalCycle;
        const currentIdx = Math.floor(cyclePos / WALLPAPER_DURATION_MS);
        const progress =
          (cyclePos - currentIdx * WALLPAPER_DURATION_MS) /
          WALLPAPER_DURATION_MS;
        const nextIdx = (currentIdx + 1) % sprites.length;

        const fadeStart = 1 - FADE_DURATION_RATIO;
        const fadeProgress = Math.max(
          0,
          (progress - fadeStart) / FADE_DURATION_RATIO,
        );
        const fade = easeInOut(Math.min(fadeProgress, 1));

        for (let i = 0; i < sprites.length; i++) {
          const s = sprites[i];

          if (i === currentIdx) {
            s.x = width / 2;
            s.y = height / 2;
            s.alpha = 1 - fade;
            s.visible = true;
            applyKenBurns(s, width, height, progress, baseScaleCache.get(s)!);
          } else if (i === nextIdx && fade > 0) {
            s.x = width / 2;
            s.y = height / 2;
            s.alpha = fade;
            s.visible = true;
            applyKenBurns(s, width, height, progress, baseScaleCache.get(s)!);
          } else if (s.visible) {
            // 只有之前可见的精灵才需要被隐藏，减少不必要的写入
            s.alpha = 0;
            s.visible = false;
          }
        }
      };

      app.ticker.add(animate);
    };

    // 标签页切到后台/最小化时暂停渲染循环，节省 CPU/GPU 和电量
    const handleVisibilityChange = () => {
      if (document.hidden) {
        app.ticker.stop();
      } else {
        app.ticker.start();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    initApp();

    return () => {
      destroyed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      abortController.abort();
      app.ticker.stop();
      for (const s of sprites) {
        s.destroy(true);
      }
      app.destroy();
    };
  }, [images]);

  if (images.length === 0) {
    return null;
  }

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
    </div>
  );
}

function coverScale(sprite: Sprite, width: number, height: number): number {
  // 标准的“cover”缩放公式：取两个轴各自所需缩放比例中较大的一个，
  // 保证图片完全覆盖容器且不改变宽高比（不会拉伸变形）。
  return Math.max(width / sprite.texture.width, height / sprite.texture.height);
}

function applyKenBurns(
  sprite: Sprite,
  width: number,
  height: number,
  progress: number,
  baseScale: number,
): void {
  const zoom = 1.05 + 0.1 * (0.5 - 0.5 * Math.cos(progress * TAU));
  const scale = baseScale * zoom;
  sprite.scale.set(scale);

  const scaledW = sprite.texture.width * scale;
  const scaledH = sprite.texture.height * scale;
  const availX = Math.max(0, (scaledW - width) / 2);
  const availY = Math.max(0, (scaledH - height) / 2);

  const panRatio = 0.6;
  const angle = progress * TAU;
  sprite.x = width / 2 + Math.sin(angle) * availX * panRatio;
  sprite.y = height / 2 + Math.cos(angle) * availY * panRatio;
}
