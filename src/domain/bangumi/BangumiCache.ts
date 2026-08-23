import type { Context } from "ajanuw-context";
import type { NonEmptyString } from "../common/NonEmptyString";
import type {
  BangumiCalendarDay,
  BangumiCharacter,
  BangumiEpisodesPage,
  BangumiPerson,
  BangumiSubject,
} from "./BangumiSchemas";

export interface BangumiCache {
  getCalendar(ctx: Context): Promise<BangumiCalendarDay[] | null>;
  setCalendar(ctx: Context, calendar: BangumiCalendarDay[]): Promise<void>;

  getRankedSubjects(ctx: Context): Promise<BangumiSubject[] | null>;
  setRankedSubjects(ctx: Context, subjects: BangumiSubject[]): Promise<void>;

  getSubject(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<BangumiSubject | null>;
  setSubject(
    ctx: Context,
    subjectId: NonEmptyString,
    subject: BangumiSubject,
  ): Promise<void>;

  getEpisodes(
    ctx: Context,
    subjectId: NonEmptyString,
    offset: number,
    limit: number,
  ): Promise<BangumiEpisodesPage | null>;
  setEpisodes(
    ctx: Context,
    subjectId: NonEmptyString,
    offset: number,
    limit: number,
    page: BangumiEpisodesPage,
  ): Promise<void>;

  getPersons(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<BangumiPerson[] | null>;
  setPersons(
    ctx: Context,
    subjectId: NonEmptyString,
    persons: BangumiPerson[],
  ): Promise<void>;

  getCharacters(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<BangumiCharacter[] | null>;
  setCharacters(
    ctx: Context,
    subjectId: NonEmptyString,
    characters: BangumiCharacter[],
  ): Promise<void>;
}
