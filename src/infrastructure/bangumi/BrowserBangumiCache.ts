import type { Context } from "ajanuw-context";
import { Duration } from "ajanuw-duration";
import type { BangumiCache } from "@/domain/bangumi/BangumiCache";
import {
  type BangumiCalendarDay,
  BangumiCalendarResponseSchema,
  type BangumiCharacter,
  BangumiCharactersResponseSchema,
  type BangumiEpisodesPage,
  BangumiEpisodesPageSchema,
  type BangumiPerson,
  BangumiPersonsResponseSchema,
  type BangumiSubject,
  BangumiSubjectSchema,
} from "@/domain/bangumi/BangumiSchemas";
import type { CacheStore } from "@/infrastructure/storage/CacheStore";

export class BrowserBangumiCache implements BangumiCache {
  private readonly ttl1MMs = new Duration({ days: 30 }).inMilliseconds;

  constructor(private readonly store: CacheStore) {}

  getCalendar(_ctx: Context): Promise<BangumiCalendarDay[] | null> {
    return this.store.getItem(
      "bangumi:calendar",
      BangumiCalendarResponseSchema,
    );
  }

  setCalendar(_ctx: Context, calendar: BangumiCalendarDay[]): Promise<void> {
    return this.store.setItem(
      "bangumi:calendar",
      calendar,
      new Duration({ days: 7 }).inMilliseconds,
    );
  }

  getSubject(_ctx: Context, subjectId: string): Promise<BangumiSubject | null> {
    return this.store.getItem(
      `bangumi:subject:${subjectId}`,
      BangumiSubjectSchema,
    );
  }

  setSubject(
    _ctx: Context,
    subjectId: string,
    subject: BangumiSubject,
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
  ): Promise<BangumiEpisodesPage | null> {
    return this.store.getItem(
      `bangumi:episodes:${subjectId}:${offset}:${limit}`,
      BangumiEpisodesPageSchema,
    );
  }

  setEpisodes(
    _ctx: Context,
    subjectId: string,
    offset: number,
    limit: number,
    page: BangumiEpisodesPage,
  ): Promise<void> {
    return this.store.setItem(
      `bangumi:episodes:${subjectId}:${offset}:${limit}`,
      page,
      new Duration({ days: 1 }).inMilliseconds,
    );
  }

  getPersons(
    _ctx: Context,
    subjectId: string,
  ): Promise<BangumiPerson[] | null> {
    return this.store.getItem(
      `bangumi:persons:${subjectId}`,
      BangumiPersonsResponseSchema,
    );
  }

  setPersons(
    _ctx: Context,
    subjectId: string,
    persons: BangumiPerson[],
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
  ): Promise<BangumiCharacter[] | null> {
    return this.store.getItem(
      `bangumi:characters:${subjectId}`,
      BangumiCharactersResponseSchema,
    );
  }

  setCharacters(
    _ctx: Context,
    subjectId: string,
    characters: BangumiCharacter[],
  ): Promise<void> {
    return this.store.setItem(
      `bangumi:characters:${subjectId}`,
      characters,
      this.ttl1MMs,
    );
  }
}
