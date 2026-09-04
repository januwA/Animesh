import { beforeEach, describe, expect, it } from "vitest";
import { backgroundWallpaperStore } from "./backgroundWallpaperStore";

describe("useBackgroundWallpaperStore", () => {
  beforeEach(() => {
    backgroundWallpaperStore.getState().reset();
  });

  it("初始状态 showWallpaper 应该为 false", () => {
    expect(backgroundWallpaperStore.getState().showWallpaper).toBe(false);
  });

  it("setShowWallpaper 应该能设置 showWallpaper 的值", () => {
    const store = backgroundWallpaperStore.getState();
    store.setShowWallpaper(true);
    expect(backgroundWallpaperStore.getState().showWallpaper).toBe(true);

    store.setShowWallpaper(false);
    expect(backgroundWallpaperStore.getState().showWallpaper).toBe(false);
  });

  it("reset 应该将 showWallpaper 重置为初始状态", () => {
    const store = backgroundWallpaperStore.getState();
    store.setShowWallpaper(true);
    expect(backgroundWallpaperStore.getState().showWallpaper).toBe(true);

    store.reset();
    expect(backgroundWallpaperStore.getState().showWallpaper).toBe(false);
  });
});
