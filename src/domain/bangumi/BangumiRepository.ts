import type { Context } from "ajanuw-context";
import type {
  BangumiCalendarDay,
  BangumiCharacter,
  BangumiEpisodesPage,
  BangumiPerson,
  BangumiSubject,
} from "./BangumiSchemas";

export interface BangumiRepository {
  getCalendar(ctx: Context): Promise<BangumiCalendarDay[]>;
  getSubject(ctx: Context, subjectId: string): Promise<BangumiSubject>;
  getEpisodes(
    ctx: Context,
    subjectId: string,
    offset: number,
    limit: number,
  ): Promise<BangumiEpisodesPage>;
  getSubjectPersons(ctx: Context, subjectId: string): Promise<BangumiPerson[]>;
  getSubjectCharacters(
    ctx: Context,
    subjectId: string,
  ): Promise<BangumiCharacter[]>;
}
