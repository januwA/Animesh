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

export interface NextSeasonSubjectsParams {
  year: number;
  month: number;
  limit: number;
  offset: number;
}

export interface NextSeasonSubjectsPage {
  items: AnimeSubject[];
  hasNextPage: boolean;
}

export interface AnimeRepository {
  getCalendar(ctx: Context): Promise<AnimeCalendarDay[]>;
  /** 获取指定类型指定年月的按 rank 排序榜单条目（GET /v0/subjects）。 */
  getRankedSubjects(
    ctx: Context,
    params: {
      year: number;
      month: number;
      sort?: "rank" | "date";
      // 0 为 其他. 1 为 TV. 2 为 OVA. 3 为 Movie. 5 为 WEB
      cat?: 0 | 1 | 2 | 3 | 5;
    },
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
  /** 获取指定年月的下季度新番条目（分页） */
  getNextSeasonSubjects(
    ctx: Context,
    params: NextSeasonSubjectsParams,
  ): Promise<NextSeasonSubjectsPage>;
}
