import { z } from "zod";

export interface AnimeCalendarItem {
  id: number;
  name: string;
  image: string;
  rating: number;
}

export interface AnimeCalendarDay {
  weekday: { id: number };
  items: AnimeCalendarItem[];
}

export interface AnimeSubject {
  id: number;
  name: string;
  summary: string;
  image: string;
  rating: number;
  date?: string | null;
  eps?: number | null;
  platform?: string | null;
}

export interface AnimeEpisode {
  id: number;
  sort: number;
  name: string;
  duration?: string | null;
  airdate?: string | null;
}

export interface AnimePerson {
  id: number;
  name: string;
  relation: string;
  eps: string;
  image: string;
}

export interface AnimeActor {
  name: string;
}

export interface AnimeCharacter {
  id: number;
  name: string;
  relation: string;
  image: string;
  actors: AnimeActor[];
}

export interface AnimeEpisodesPage {
  items: AnimeEpisode[];
  total: number;
}

export interface AnimeSubjectSearchParams {
  keyword: string;
  limit: number;
  offset: number;
}

export interface AnimeSubjectSearchResult {
  items: AnimeSubject[];
  total: number;
}

export const AnimePlatformSchema = z.enum(["bangumi", "anilist"]);
export type AnimePlatform = z.infer<typeof AnimePlatformSchema>;

/** 下季度新番 — 按月份分组的条目 */
export interface NextSeasonMonthGroup {
  month: number;
  label: string;
  items: AnimeCalendarItem[];
}

export type NextSeasonData = NextSeasonMonthGroup[];
