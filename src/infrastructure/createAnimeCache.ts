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
  AnimeCalendarStoredSchema,
  AnimeCharactersStoredSchema,
  AnimeEpisodesPageStoredSchema,
  AnimeNextSeasonStoredSchema,
  AnimePersonsStoredSchema,
  AnimeRankedSubjectsStoredSchema,
  AnimeSubjectStoredSchema,
} from "./animeStoredSchemas";

const TTL = {
  calendar: new Duration({ days: 7 }).inMilliseconds,
  subject: new Duration({ days: 30 }).inMilliseconds,
  persons: new Duration({ days: 30 }).inMilliseconds,
  characters: new Duration({ days: 30 }).inMilliseconds,
  episodes: new Duration({ days: 1 }).inMilliseconds,
  rankedSubjects: new Duration({ days: 1 }).inMilliseconds,
  nextSeason: new Duration({ days: 1 }).inMilliseconds,
};

interface AnimeCacheConfig {
  prefix: string;
  /** episodes 缓存键是否包含 offset/limit（Bangumi 支持真分页） */
  episodesKeyWithPagination: boolean;
  /** 是否支持 rankedSubjects（Anilist 无此 API） */
  supportsRankedSubjects: boolean;
}

export function createAnimeCache(config: AnimeCacheConfig) {
  return class BrowserAnimeCache implements AnimeCache {
    constructor(private readonly store: CacheStore) {}

    getCalendar(_ctx: Context): Promise<AnimeCalendarDay[] | null> {
      return this.store.getItem(
        `${config.prefix}:calendar`,
        AnimeCalendarStoredSchema,
      );
    }

    setCalendar(_ctx: Context, calendar: AnimeCalendarDay[]): Promise<void> {
      return this.store.setItem(
        `${config.prefix}:calendar`,
        calendar,
        TTL.calendar,
      );
    }

    getRankedSubjects(_ctx: Context): Promise<AnimeSubject[] | null> {
      if (!config.supportsRankedSubjects) return Promise.resolve(null);
      return this.store.getItem(
        `${config.prefix}:ranked-subjects`,
        AnimeRankedSubjectsStoredSchema,
      );
    }

    setRankedSubjects(_ctx: Context, subjects: AnimeSubject[]): Promise<void> {
      if (!config.supportsRankedSubjects) return Promise.resolve();
      return this.store.setItem(
        `${config.prefix}:ranked-subjects`,
        subjects,
        TTL.rankedSubjects,
      );
    }

    getSubject(
      _ctx: Context,
      subjectId: NonEmptyString,
    ): Promise<AnimeSubject | null> {
      return this.store.getItem(
        `${config.prefix}:subject:${subjectId}`,
        AnimeSubjectStoredSchema,
      );
    }

    setSubject(
      _ctx: Context,
      subjectId: NonEmptyString,
      subject: AnimeSubject,
    ): Promise<void> {
      return this.store.setItem(
        `${config.prefix}:subject:${subjectId}`,
        subject,
        TTL.subject,
      );
    }

    getEpisodes(
      _ctx: Context,
      subjectId: NonEmptyString,
      offset: number,
      limit: number,
    ): Promise<AnimeEpisodesPage | null> {
      const key = config.episodesKeyWithPagination
        ? `${config.prefix}:episodes:${subjectId}:${offset}:${limit}`
        : `${config.prefix}:episodes:${subjectId}`;
      return this.store.getItem(key, AnimeEpisodesPageStoredSchema);
    }

    setEpisodes(
      _ctx: Context,
      subjectId: NonEmptyString,
      offset: number,
      limit: number,
      page: AnimeEpisodesPage,
    ): Promise<void> {
      const key = config.episodesKeyWithPagination
        ? `${config.prefix}:episodes:${subjectId}:${offset}:${limit}`
        : `${config.prefix}:episodes:${subjectId}`;
      return this.store.setItem(key, page, TTL.episodes);
    }

    getPersons(
      _ctx: Context,
      subjectId: NonEmptyString,
    ): Promise<AnimePerson[] | null> {
      return this.store.getItem(
        `${config.prefix}:persons:${subjectId}`,
        AnimePersonsStoredSchema,
      );
    }

    setPersons(
      _ctx: Context,
      subjectId: NonEmptyString,
      persons: AnimePerson[],
    ): Promise<void> {
      return this.store.setItem(
        `${config.prefix}:persons:${subjectId}`,
        persons,
        TTL.persons,
      );
    }

    getCharacters(
      _ctx: Context,
      subjectId: NonEmptyString,
    ): Promise<AnimeCharacter[] | null> {
      return this.store.getItem(
        `${config.prefix}:characters:${subjectId}`,
        AnimeCharactersStoredSchema,
      );
    }

    setCharacters(
      _ctx: Context,
      subjectId: NonEmptyString,
      characters: AnimeCharacter[],
    ): Promise<void> {
      return this.store.setItem(
        `${config.prefix}:characters:${subjectId}`,
        characters,
        TTL.characters,
      );
    }

    getNextSeason(
      _ctx: Context,
      year: number,
      months: number[],
    ): Promise<AnimeSubject[] | null> {
      return this.store.getItem(
        `${config.prefix}:next-season:${year}:${months.join(",")}`,
        AnimeNextSeasonStoredSchema,
      );
    }

    setNextSeason(
      _ctx: Context,
      year: number,
      months: number[],
      subjects: AnimeSubject[],
    ): Promise<void> {
      return this.store.setItem(
        `${config.prefix}:next-season:${year}:${months.join(",")}`,
        subjects,
        TTL.nextSeason,
      );
    }
  };
}
