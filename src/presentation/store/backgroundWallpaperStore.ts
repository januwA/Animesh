import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface BackgroundWallpaperStoreState {
  showWallpaper: boolean;
  setShowWallpaper: (show: boolean) => void;
  reset: () => void;
}

export const backgroundWallpaperStore = create<BackgroundWallpaperStoreState>()(
  persist(
    (set) => ({
      showWallpaper: false,
      setShowWallpaper: (show) => set({ showWallpaper: show }),
      reset: () => set({ showWallpaper: false }),
    }),
    {
      name: "ani_background_wallpaper",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
