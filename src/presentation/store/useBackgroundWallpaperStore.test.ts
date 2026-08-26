import { beforeEach, describe, expect, it } from "vitest";
import { useBackgroundWallpaperStore } from "./useBackgroundWallpaperStore";

describe("useBackgroundWallpaperStore", () => {
  beforeEach(() => {
    useBackgroundWallpaperStore.getState().reset();
  });

  it("初始状态 showWallpaper 应该为 false", () => {
    expect(useBackgroundWallpaperStore.getState().showWallpaper).toBe(false);
  });

  it("setShowWallpaper 应该能设置 showWallpaper 的值", () => {
    const store = useBackgroundWallpaperStore.getState();
    store.setShowWallpaper(true);
    expect(useBackgroundWallpaperStore.getState().showWallpaper).toBe(true);

    store.setShowWallpaper(false);
    expect(useBackgroundWallpaperStore.getState().showWallpaper).toBe(false);
  });

  it("reset 应该将 showWallpaper 重置为初始状态", () => {
    const store = useBackgroundWallpaperStore.getState();
    store.setShowWallpaper(true);
    expect(useBackgroundWallpaperStore.getState().showWallpaper).toBe(true);

    store.reset();
    expect(useBackgroundWallpaperStore.getState().showWallpaper).toBe(false);
  });
});
