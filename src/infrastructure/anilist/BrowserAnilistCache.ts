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
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { CacheStore } from "@/infrastructure/storage/CacheStore";
import {
  AnilistCalendarStoredSchema,
  AnilistCharacterStoredSchema,
  AnilistEpisodesStoredSchema,
  AnilistNextSeasonStoredSchema,
  AnilistPersonStoredSchema,
  AnilistSubjectStoredSchema,
} from "./AnilistSchemas";

const CACHE_TTL = new Duration({ days: 1 }).inMilliseconds;

export class BrowserAnilistCache implements AnimeCache {
  constructor(private readonly store: CacheStore) {}

  getCalendar(_ctx: Context): Promise<AnimeCalendarDay[] | null> {
    return this.store.getItem("anilist:calendar", AnilistCalendarStoredSchema);
  }

  setCalendar(_ctx: Context, calendar: AnimeCalendarDay[]): Promise<void> {
    return this.store.setItem("anilist:calendar", calendar, CACHE_TTL);
  }

  getRankedSubjects(_ctx: Context): Promise<AnimeSubject[] | null> {
    return Promise.resolve(null);
  }

  setRankedSubjects(_ctx: Context, _subjects: AnimeSubject[]): Promise<void> {
    return Promise.resolve();
  }

  getSubject(
    _ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimeSubject | null> {
    return this.store.getItem(
      `anilist:subject:${subjectId}`,
      AnilistSubjectStoredSchema,
    );
  }

  setSubject(
    _ctx: Context,
    subjectId: NonEmptyString,
    subject: AnimeSubject,
  ): Promise<void> {
    return this.store.setItem(
      `anilist:subject:${subjectId}`,
      subject,
      CACHE_TTL,
    );
  }

  getEpisodes(
    _ctx: Context,
    subjectId: NonEmptyString,
    _offset: number,
    _limit: number,
  ): Promise<AnimeEpisodesPage | null> {
    return this.store.getItem(
      `anilist:episodes:${subjectId}`,
      AnilistEpisodesStoredSchema,
    );
  }

  setEpisodes(
    _ctx: Context,
    subjectId: NonEmptyString,
    _offset: number,
    _limit: number,
    page: AnimeEpisodesPage,
  ): Promise<void> {
    return this.store.setItem(`anilist:episodes:${subjectId}`, page, CACHE_TTL);
  }

  getPersons(
    _ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimePerson[] | null> {
    return this.store.getItem(
      `anilist:persons:${subjectId}`,
      AnilistPersonStoredSchema.array(),
    );
  }

  setPersons(
    _ctx: Context,
    subjectId: NonEmptyString,
    persons: AnimePerson[],
  ): Promise<void> {
    return this.store.setItem(
      `anilist:persons:${subjectId}`,
      persons,
      CACHE_TTL,
    );
  }

  getCharacters(
    _ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimeCharacter[] | null> {
    return this.store.getItem(
      `anilist:characters:${subjectId}`,
      AnilistCharacterStoredSchema.array(),
    );
  }

  setCharacters(
    _ctx: Context,
    subjectId: NonEmptyString,
    characters: AnimeCharacter[],
  ): Promise<void> {
    return this.store.setItem(
      `anilist:characters:${subjectId}`,
      characters,
      CACHE_TTL,
    );
  }

  getNextSeason(
    _ctx: Context,
    year: number,
    months: number[],
  ): Promise<AnimeSubject[] | null> {
    return this.store.getItem(
      `anilist:next-season:${year}:${months.join(",")}`,
      AnilistNextSeasonStoredSchema,
    );
  }

  setNextSeason(
    _ctx: Context,
    year: number,
    months: number[],
    subjects: AnimeSubject[],
  ): Promise<void> {
    return this.store.setItem(
      `anilist:next-season:${year}:${months.join(",")}`,
      subjects,
      CACHE_TTL,
    );
  }
}
