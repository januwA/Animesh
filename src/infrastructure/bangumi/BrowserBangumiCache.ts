import { createAnimeCache } from "@/infrastructure/createAnimeCache";

export const BrowserBangumiCache = createAnimeCache({
  prefix: "bangumi",
  episodesKeyWithPagination: true,
  supportsRankedSubjects: true,
});
