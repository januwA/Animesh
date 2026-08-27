import type { Context } from "ajanuw-context";
import { Duration } from "ajanuw-duration";
import type { AnimeCache } from "@/domain/anime/AnimeCache";
import type {
  AnimeCalendarDay,
  AnimeCharacter,
  AnimeEpisodesPage,
  AnimePerson,
  AnimeSubject,
} from "@/domain/anime/AnimeSchemas";
import type { CacheStore } from "@/infrastructure/storage/CacheStore";
import {
  BangumiCalendarStoredSchema,
  BangumiCharactersStoredSchema,
  BangumiEpisodesPageStoredSchema,
  BangumiNextSeasonStoredSchema,
  BangumiPersonsStoredSchema,
  BangumiRankedSubjectsStoredSchema,
  BangumiSubjectStoredSchema,
} from "./BangumiSchemas";

export class BrowserBangumiCache implements AnimeCache {
  private readonly ttl1MMs = new Duration({ days: 30 }).inMilliseconds;

  constructor(private readonly store: CacheStore) {}

  getCalendar(_ctx: Context): Promise<AnimeCalendarDay[] | null> {
    return this.store.getItem("bangumi:calendar", BangumiCalendarStoredSchema);
  }

  setCalendar(_ctx: Context, calendar: AnimeCalendarDay[]): Promise<void> {
    return this.store.setItem(
      "bangumi:calendar",
      calendar,
      new Duration({ days: 7 }).inMilliseconds,
    );
  }

  getRankedSubjects(_ctx: Context): Promise<AnimeSubject[] | null> {
    return this.store.getItem(
      "bangumi:ranked-subjects",
      BangumiRankedSubjectsStoredSchema,
    );
  }

  setRankedSubjects(_ctx: Context, subjects: AnimeSubject[]): Promise<void> {
    return this.store.setItem(
      "bangumi:ranked-subjects",
      subjects,
      new Duration({ days: 1 }).inMilliseconds,
    );
  }

  getSubject(_ctx: Context, subjectId: string): Promise<AnimeSubject | null> {
    return this.store.getItem(
      `bangumi:subject:${subjectId}`,
      BangumiSubjectStoredSchema,
    );
  }

  setSubject(
    _ctx: Context,
    subjectId: string,
    subject: AnimeSubject,
  ): Promise<void> {
    return this.store.setItem(
      `bangumi:subject:${subjectId}`,
      subject,
      this.ttl1MMs,
    );
  }

  getEpisodes(
    _ctx: Context,
    subjectId: string,
    offset: number,
    limit: number,
  ): Promise<AnimeEpisodesPage | null> {
    return this.store.getItem(
      `bangumi:episodes:${subjectId}:${offset}:${limit}`,
      BangumiEpisodesPageStoredSchema,
    );
  }

  setEpisodes(
    _ctx: Context,
    subjectId: string,
    offset: number,
    limit: number,
    page: AnimeEpisodesPage,
  ): Promise<void> {
    return this.store.setItem(
      `bangumi:episodes:${subjectId}:${offset}:${limit}`,
      page,
      new Duration({ days: 1 }).inMilliseconds,
    );
  }

  getPersons(_ctx: Context, subjectId: string): Promise<AnimePerson[] | null> {
    return this.store.getItem(
      `bangumi:persons:${subjectId}`,
      BangumiPersonsStoredSchema,
    );
  }

  setPersons(
    _ctx: Context,
    subjectId: string,
    persons: AnimePerson[],
  ): Promise<void> {
    return this.store.setItem(
      `bangumi:persons:${subjectId}`,
      persons,
      this.ttl1MMs,
    );
  }

  getCharacters(
    _ctx: Context,
    subjectId: string,
  ): Promise<AnimeCharacter[] | null> {
    return this.store.getItem(
      `bangumi:characters:${subjectId}`,
      BangumiCharactersStoredSchema,
    );
  }

  setCharacters(
    _ctx: Context,
    subjectId: string,
    characters: AnimeCharacter[],
  ): Promise<void> {
    return this.store.setItem(
      `bangumi:characters:${subjectId}`,
      characters,
      this.ttl1MMs,
    );
  }

  getNextSeason(
    _ctx: Context,
    year: number,
    months: number[],
  ): Promise<AnimeSubject[] | null> {
    return this.store.getItem(
      `bangumi:next-season:${year}:${months.join(",")}`,
      BangumiNextSeasonStoredSchema,
    );
  }

  setNextSeason(
    _ctx: Context,
    year: number,
    months: number[],
    subjects: AnimeSubject[],
  ): Promise<void> {
    return this.store.setItem(
      `bangumi:next-season:${year}:${months.join(",")}`,
      subjects,
      new Duration({ days: 1 }).inMilliseconds,
    );
  }
}
