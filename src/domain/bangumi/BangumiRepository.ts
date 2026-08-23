import type { Context } from "ajanuw-context";
import type { NonEmptyString } from "../common/NonEmptyString";
import type {
  BangumiCalendarDay,
  BangumiCharacter,
  BangumiEpisodesPage,
  BangumiPerson,
  BangumiSubject,
  BangumiSubjectSearchParams,
  BangumiSubjectSearchResult,
} from "./BangumiSchemas";

export interface BangumiRepository {
  getCalendar(ctx: Context): Promise<BangumiCalendarDay[]>;
  /** 获取指定类型指定年月的按 rank 排序榜单条目（GET /v0/subjects）。 */
  getRankedSubjects(
    ctx: Context,
    year: number,
    month: number,
    limit: number,
  ): Promise<BangumiSubject[]>;
  getSubject(ctx: Context, subjectId: NonEmptyString): Promise<BangumiSubject>;
  getEpisodes(
    ctx: Context,
    subjectId: NonEmptyString,
    offset: number,
    limit: number,
  ): Promise<BangumiEpisodesPage>;
  getSubjectPersons(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<BangumiPerson[]>;
  getSubjectCharacters(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<BangumiCharacter[]>;
  searchSubjects(
    ctx: Context,
    params: BangumiSubjectSearchParams,
  ): Promise<BangumiSubjectSearchResult>;
}
