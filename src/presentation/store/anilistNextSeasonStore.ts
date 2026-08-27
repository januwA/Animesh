import type { NextSeasonData } from "@/domain/anime/AnimeSchemas";
import { createAnimeStore } from "./createAnimeStore";

export const useAnilistNextSeasonStore = createAnimeStore({
  data: [] as NextSeasonData,
  activeMonth: null as number | null,
});
