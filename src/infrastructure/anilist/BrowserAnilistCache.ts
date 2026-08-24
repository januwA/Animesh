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
import { AnilistCalendarStoredSchema } from "./AnilistSchemas";

function notImplemented(method: string): never {
  throw new Error(`AnilistCache.${method} is not implemented`);
}

export class BrowserAnilistCache implements AnimeCache {
  constructor(private readonly store: CacheStore) {}

  getCalendar(_ctx: Context): Promise<AnimeCalendarDay[] | null> {
    return this.store.getItem("anilist:calendar", AnilistCalendarStoredSchema);
  }

  setCalendar(_ctx: Context, calendar: AnimeCalendarDay[]): Promise<void> {
    return this.store.setItem(
      "anilist:calendar",
      calendar,
      new Duration({ days: 1 }).inMilliseconds,
    );
  }

  getRankedSubjects(_ctx: Context): Promise<AnimeSubject[] | null> {
    notImplemented("getRankedSubjects");
  }

  setRankedSubjects(_ctx: Context, _subjects: AnimeSubject[]): Promise<void> {
    notImplemented("setRankedSubjects");
  }

  getSubject(
    _ctx: Context,
    _subjectId: NonEmptyString,
  ): Promise<AnimeSubject | null> {
    notImplemented("getSubject");
  }

  setSubject(
    _ctx: Context,
    _subjectId: NonEmptyString,
    _subject: AnimeSubject,
  ): Promise<void> {
    notImplemented("setSubject");
  }

  getEpisodes(
    _ctx: Context,
    _subjectId: NonEmptyString,
    _offset: number,
    _limit: number,
  ): Promise<AnimeEpisodesPage | null> {
    notImplemented("getEpisodes");
  }

  setEpisodes(
    _ctx: Context,
    _subjectId: NonEmptyString,
    _offset: number,
    _limit: number,
    _page: AnimeEpisodesPage,
  ): Promise<void> {
    notImplemented("setEpisodes");
  }

  getPersons(
    _ctx: Context,
    _subjectId: NonEmptyString,
  ): Promise<AnimePerson[] | null> {
    notImplemented("getPersons");
  }

  setPersons(
    _ctx: Context,
    _subjectId: NonEmptyString,
    _persons: AnimePerson[],
  ): Promise<void> {
    notImplemented("setPersons");
  }

  getCharacters(
    _ctx: Context,
    _subjectId: NonEmptyString,
  ): Promise<AnimeCharacter[] | null> {
    notImplemented("getCharacters");
  }

  setCharacters(
    _ctx: Context,
    _subjectId: NonEmptyString,
    _characters: AnimeCharacter[],
  ): Promise<void> {
    notImplemented("setCharacters");
  }
}
