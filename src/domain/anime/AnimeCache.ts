import type { Context } from "ajanuw-context";
import type { NonEmptyString } from "../common/NonEmptyString";
import type {
  AnimeCalendarDay,
  AnimeCharacter,
  AnimeEpisodesPage,
  AnimePerson,
  AnimeSubject,
} from "./AnimeSchemas";

export interface AnimeCache {
  getCalendar(ctx: Context): Promise<AnimeCalendarDay[] | null>;
  setCalendar(ctx: Context, calendar: AnimeCalendarDay[]): Promise<void>;

  getRankedSubjects(ctx: Context): Promise<AnimeSubject[] | null>;
  setRankedSubjects(ctx: Context, subjects: AnimeSubject[]): Promise<void>;

  getSubject(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimeSubject | null>;
  setSubject(
    ctx: Context,
    subjectId: NonEmptyString,
    subject: AnimeSubject,
  ): Promise<void>;

  getEpisodes(
    ctx: Context,
    subjectId: NonEmptyString,
    offset: number,
    limit: number,
  ): Promise<AnimeEpisodesPage | null>;
  setEpisodes(
    ctx: Context,
    subjectId: NonEmptyString,
    offset: number,
    limit: number,
    page: AnimeEpisodesPage,
  ): Promise<void>;

  getPersons(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimePerson[] | null>;
  setPersons(
    ctx: Context,
    subjectId: NonEmptyString,
    persons: AnimePerson[],
  ): Promise<void>;

  getCharacters(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimeCharacter[] | null>;
  setCharacters(
    ctx: Context,
    subjectId: NonEmptyString,
    characters: AnimeCharacter[],
  ): Promise<void>;

  getNextSeason(
    ctx: Context,
    year: number,
    season: number[],
  ): Promise<AnimeSubject[] | null>;
  setNextSeason(
    ctx: Context,
    year: number,
    season: number[],
    subjects: AnimeSubject[],
  ): Promise<void>;
}
