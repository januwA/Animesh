import type { Context } from "ajanuw-context";
import type { NonEmptyString } from "../common/NonEmptyString";
import type {
  AnimeCalendarDay,
  AnimeCharacter,
  AnimeEpisodesPage,
  AnimePerson,
  AnimeSubject,
  AnimeSubjectSearchParams,
  AnimeSubjectSearchResult,
} from "./AnimeSchemas";

export interface RankedSubjectsPage {
  items: AnimeSubject[];
  total: number;
}

export interface AnimeRepository {
  getCalendar(ctx: Context): Promise<AnimeCalendarDay[]>;
  /** 获取指定类型指定年月的按 rank 排序榜单条目（GET /v0/subjects）。 */
  getRankedSubjects(
    ctx: Context,
    year: number,
    month: number,
    limit?: number,
    offset?: number,
  ): Promise<RankedSubjectsPage>;
  getSubject(ctx: Context, subjectId: NonEmptyString): Promise<AnimeSubject>;
  getEpisodes(
    ctx: Context,
    subjectId: NonEmptyString,
    offset: number,
    limit: number,
  ): Promise<AnimeEpisodesPage>;
  getSubjectPersons(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimePerson[]>;
  getSubjectCharacters(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimeCharacter[]>;
  searchSubjects(
    ctx: Context,
    params: AnimeSubjectSearchParams,
  ): Promise<AnimeSubjectSearchResult>;
  /** 获取指定季度的动画条目（Bangumi 按月份查询，AniList 按 season 查询）。 */
  getNextSeasonSubjects(
    ctx: Context,
    year: number,
    season: number[],
  ): Promise<AnimeSubject[]>;
}
