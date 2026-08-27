import { createAnimeCache } from "@/infrastructure/createAnimeCache";

export const BrowserAnilistCache = createAnimeCache({
  prefix: "anilist",
  episodesKeyWithPagination: false,
  supportsRankedSubjects: false,
});
