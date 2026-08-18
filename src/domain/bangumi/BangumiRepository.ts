import type { Context } from "ajanuw-context";
import type { NonEmptyString } from "../common/NonEmptyString";
import type {
  BangumiCalendarDay,
  BangumiCharacter,
  BangumiEpisodesPage,
  BangumiPerson,
  BangumiSubject,
} from "./BangumiSchemas";

export interface BangumiRepository {
  getCalendar(ctx: Context): Promise<BangumiCalendarDay[]>;
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
}
