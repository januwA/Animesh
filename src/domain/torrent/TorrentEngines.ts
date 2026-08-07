export const TORRENT_SEARCH_ENGINES = [
  "anibt",
  "acgrip",
  "mikan",
  "dmhy",
  "bangumi_moe",
  "nyaa",
] as const;

export type TorrentSearchEngine = (typeof TORRENT_SEARCH_ENGINES)[number];
