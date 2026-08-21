import { useEffect, useRef } from "react";
import type { UseBackgroundWallpaperDeps } from "@/presentation/hooks/useBackgroundWallpaper";
import { useBackgroundWallpaper } from "@/presentation/hooks/useBackgroundWallpaper";
import { renderWallpaperFrame } from "./wallpaperRenderer";

export interface BackgroundWallpaperProps {
  deps: UseBackgroundWallpaperDeps;
}

const OVERLAY_CLASS =
  "absolute inset-0 bg-background/70 transition-colors duration-300";

/**
 * 全局背景壁纸：预取榜单封面并在 canvas 上做 Ken Burns 交叉淡入淡出。
 * 加载失败/无数据时渲染 null，静默降级为 body 渐变背景。
 */
export function BackgroundWallpaper({ deps }: BackgroundWallpaperProps) {
  const { status, images } = useBackgroundWallpaper(deps);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (status !== "ready" || images.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const fitCanvas = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    };
    fitCanvas();
    const observer = new ResizeObserver(fitCanvas);
    observer.observe(canvas);

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frameId = 0;
    let startTime: number | null = null;
    const render = (now: number) => {
      if (startTime === null) startTime = now;
      if (!document.hidden) {
        renderWallpaperFrame(
          ctx,
          canvas.width,
          canvas.height,
          images,
          now - startTime,
        );
      }
      frameId = requestAnimationFrame(render);
    };

    if (prefersReducedMotion) {
      renderWallpaperFrame(ctx, canvas.width, canvas.height, images, 0);
    } else {
      frameId = requestAnimationFrame(render);
    }

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, [status, images]);

  if (status !== "ready" || images.length === 0) {
    return null;
  }

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className={OVERLAY_CLASS} />
    </div>
  );
}
