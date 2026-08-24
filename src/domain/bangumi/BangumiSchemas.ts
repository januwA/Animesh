export interface BangumiCalendarItem {
  id: number;
  name: string;
  image: string;
  rating: number;
}

export interface BangumiCalendarDay {
  weekday: { id: number };
  items: BangumiCalendarItem[];
}

export interface BangumiSubject {
  id: number;
  name: string;
  summary: string;
  image: string;
  rating: number;
  date?: string | null;
  eps?: number | null;
  platform?: string | null;
}

export interface BangumiEpisode {
  id: number;
  sort: number;
  name: string;
  duration?: string | null;
  airdate?: string | null;
}

export interface BangumiPerson {
  id: number;
  name: string;
  relation: string;
  eps: string;
  image: string;
}

export interface BangumiActor {
  name: string;
}

export interface BangumiCharacter {
  id: number;
  name: string;
  relation: string;
  image: string;
  actors: BangumiActor[];
}

export interface BangumiEpisodesPage {
  items: BangumiEpisode[];
  total: number;
}

/** 条目搜索请求参数（POST /v0/search/subjects） */
export interface BangumiSubjectSearchParams {
  keyword: string;
  limit: number;
  offset: number;
}

export interface BangumiSubjectSearchResult {
  items: BangumiSubject[];
  total: number;
}
