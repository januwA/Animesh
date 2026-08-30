import type { Context } from "ajanuw-context";
import { Duration } from "ajanuw-duration";
import type {
  AnimeCalendarDay,
  AnimeCharacter,
  AnimeEpisodesPage,
  AnimePerson,
  AnimeSubject,
  AnimeSubjectSearchParams,
  AnimeSubjectSearchResult,
} from "@/domain/anime/AnimeSchemas";
import type { HttpClient } from "@/domain/http/HttpClient";
import type { CacheStore } from "@/domain/storage/CacheStore";
import type {
  AnimeRepository,
  NextSeasonSubjectsPage,
  NextSeasonSubjectsParams,
  RankedSubjectsPage,
} from "../../domain/anime/AnimeRepository";
import { Cached } from "../cache/CachedDecorator";
import {
  BangumiCalendarResponseSchema,
  BangumiCharactersResponseSchema,
  BangumiEpisodesResponseSchema,
  BangumiPersonsResponseSchema,
  BangumiRankedSubjectsResponseSchema,
  BangumiSubjectSchema,
  BangumiSubjectSearchResponseSchema,
} from "./BangumiSchemas";

export class HttpBangumiRepository implements AnimeRepository {
  constructor(
    private readonly client: HttpClient,
    /** @internal accessed by @Cached decorator */
    public readonly store: CacheStore,
  ) {}

  @Cached({
    ttl: new Duration({ days: 7 }),
    excludeArgs: [0],
  })
  async getCalendar(ctx: Context): Promise<AnimeCalendarDay[]> {
    const data = await this.client.getJson<unknown>(
      "https://api.bgm.tv/calendar",
      {
        ctx,
      },
    );
    const result = BangumiCalendarResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Calendar API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  @Cached({
    ttl: new Duration({ days: 1 }),
    excludeArgs: [0],
  })
  async getRankedSubjects(
    ctx: Context,
    params: Parameters<AnimeRepository["getRankedSubjects"]>[1],
  ): Promise<RankedSubjectsPage> {
    const data = await this.client.getJson<unknown>(
      "https://api.bgm.tv/v0/subjects",
      {
        ctx,
        params: {
          type: "2",
          ...params,
        },
      },
    );

    const result = BangumiRankedSubjectsResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Ranked subjects API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  @Cached({
    ttl: new Duration({ days: 30 }),
    excludeArgs: [0],
  })
  async getSubject(ctx: Context, subjectId: string): Promise<AnimeSubject> {
    const data = await this.client.getJson<unknown>(
      `https://api.bgm.tv/v0/subjects/${subjectId}`,
      { ctx },
    );

    const result = BangumiSubjectSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Subject API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  @Cached({
    ttl: new Duration({ days: 1 }),
    excludeArgs: [0],
  })
  async getEpisodes(
    ctx: Context,
    subjectId: string,
    offset: number,
    limit: number,
  ): Promise<AnimeEpisodesPage> {
    const data = await this.client.getJson<unknown>(
      "https://api.bgm.tv/v0/episodes",
      { ctx, params: { subject_id: subjectId, limit, offset } },
    );

    const result = BangumiEpisodesResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Episodes API response structure mismatch", {
        cause: result.error,
      });
    }
    return { items: result.data.data, total: result.data.total };
  }

  @Cached({
    ttl: new Duration({ days: 30 }),
    excludeArgs: [0],
  })
  async getSubjectPersons(
    ctx: Context,
    subjectId: string,
  ): Promise<AnimePerson[]> {
    const data = await this.client.getJson<unknown>(
      `https://api.bgm.tv/v0/subjects/${subjectId}/persons`,
      { ctx, params: { subject_id: subjectId } },
    );

    const result = BangumiPersonsResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Persons API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  @Cached({
    ttl: new Duration({ days: 30 }),
    excludeArgs: [0],
  })
  async getSubjectCharacters(
    ctx: Context,
    subjectId: string,
  ): Promise<AnimeCharacter[]> {
    const data = await this.client.getJson<unknown>(
      `https://api.bgm.tv/v0/subjects/${subjectId}/characters`,
      { ctx, params: { subject_id: subjectId } },
    );

    const result = BangumiCharactersResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Characters API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  @Cached({
    ttl: new Duration({ hours: 12 }),
    excludeArgs: [0],
  })
  async searchSubjects(
    ctx: Context,
    params: AnimeSubjectSearchParams,
  ): Promise<AnimeSubjectSearchResult> {
    const response = await this.client.request(
      "https://api.bgm.tv/v0/search/subjects",
      {
        ctx,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        params: { limit: params.limit, offset: params.offset },
        body: JSON.stringify({
          keyword: params.keyword,
          filter: { type: [2], nsfw: false },
        }),
      },
    );
    const raw = await response.json();
    const result = BangumiSubjectSearchResponseSchema.safeParse(raw);
    if (!result.success) {
      throw new Error("Subject search API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  @Cached({
    ttl: new Duration({ days: 1 }),
    excludeArgs: [0],
  })
  async getNextSeasonSubjects(
    ctx: Context,
    params: NextSeasonSubjectsParams,
  ): Promise<NextSeasonSubjectsPage> {
    const data = await this.client.getJson<unknown>(
      "https://api.bgm.tv/v0/subjects",
      {
        ctx,
        params: {
          type: "2",
          year: params.year,
          month: params.month,
          limit: params.limit,
          offset: params.offset,
        },
      },
    );

    const result = BangumiRankedSubjectsResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Next season API response structure mismatch", {
        cause: result.error,
      });
    }
    return {
      items: result.data.items,
      hasNextPage: params.offset + result.data.items.length < result.data.total,
    };
  }
}
