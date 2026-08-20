import { Background, WithCancel } from "ajanuw-context";
import { useEffect, useState } from "react";
import type { GetBangumiRankedSubjectsUseCase } from "@/application/bangumi/GetBangumiRankedSubjectsUseCase";
import {
  type BackgroundImage,
  preloadBackgroundImages,
} from "@/presentation/lib/preloadBackgroundImages";

/** useBackgroundWallpaper 的依赖，由调用方（组件组合根）注入 */
export interface UseBackgroundWallpaperDeps {
  getBangumiRankedSubjectsUseCase: Pick<
    GetBangumiRankedSubjectsUseCase,
    "execute"
  >;
}

export type WallpaperStatus = "idle" | "loading" | "ready";

export interface BackgroundWallpaperState {
  status: WallpaperStatus;
  images: BackgroundImage[];
}

const INITIAL_STATE: BackgroundWallpaperState = {
  status: "loading",
  images: [],
};

export function useBackgroundWallpaper(
  deps: UseBackgroundWallpaperDeps,
): BackgroundWallpaperState {
  const { getBangumiRankedSubjectsUseCase } = deps;
  const [state, setState] = useState<BackgroundWallpaperState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;
    const [ctx, cancel] = WithCancel(Background);

    (async () => {
      try {
        const subjects = await getBangumiRankedSubjectsUseCase.execute(ctx);
        if (!active) return;
        const urls = [
          ...new Set(
            subjects
              .map((subject) => subject.image)
              .filter((url) => url.length > 0),
          ),
        ];
        const images = await preloadBackgroundImages(urls);
        if (!active) return;
        setState({ status: images.length > 0 ? "ready" : "idle", images });
      } catch {
        if (!active) return;
        setState({ status: "idle", images: [] });
      }
    })();

    return () => {
      active = false;
      cancel();
    };
  }, [getBangumiRankedSubjectsUseCase]);

  return state;
}
