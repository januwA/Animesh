import type { Context } from "ajanuw-context";
import { Duration } from "ajanuw-duration";
import type {
  AnimeRepository,
  NextSeasonSubjectsPage,
  NextSeasonSubjectsParams,
  RankedSubjectsPage,
} from "@/domain/anime/AnimeRepository";
import type {
  AnimeCalendarDay,
  AnimeCharacter,
  AnimeEpisodesPage,
  AnimePerson,
  AnimeSubject,
  AnimeSubjectSearchParams,
  AnimeSubjectSearchResult,
} from "@/domain/anime/AnimeSchemas";
import type { CacheStore } from "@/domain/storage/CacheStore";
import { Cached } from "../cache/CachedDecorator";
import type { HttpClient } from "../http/HttpClient";
import {
  AnilistCalendarResponseSchema,
  AnilistCharactersResponseSchema,
  AnilistEpisodesResponseSchema,
  AnilistNextSeasonResponseSchema,
  AnilistRankedResponseSchema,
  AnilistResponseSchema,
  AnilistSearchResponseSchema,
  AnilistStaffResponseSchema,
  AnilistSubjectResponseSchema,
} from "./AnilistSchemas";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const AIRING_SCHEDULE_QUERY = `
query ($startDate: Int!, $endDate: Int!, $page: Int!) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(
      airingAt_greater: $startDate
      airingAt_lesser: $endDate
      sort: TIME
    ) {
      id
      airingAt
      episode
      mediaId
      media {
        id
        title { romaji english native userPreferred }
        coverImage { large medium color }
        averageScore
      }
    }
  }
}
`;

const MEDIA_DETAIL_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native userPreferred }
    description(asHtml: false)
    coverImage { large medium color }
    averageScore
    episodes
    startDate { year month day }
    format
    status
  }
}
`;

const MEDIA_EPISODES_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    airingSchedule(notYetAired: false, page: 1, perPage: 250) {
      nodes {
        id
        airingAt
        episode
      }
    }
  }
}
`;

const MEDIA_CHARACTERS_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    characters(sort: ROLE) {
      edges {
        role
        node {
          id
          name { full }
          image { large }
        }
        voiceActors(language: JAPANESE) {
          name { full }
        }
      }
    }
  }
}
`;

const MEDIA_STAFF_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    staff(sort: RELEVANCE) {
      edges {
        role
        node {
          id
          name { full }
          image { large }
        }
      }
    }
  }
}
`;

const SEARCH_MEDIA_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total }
    media(search: $search, type: ANIME) {
      id
      title { romaji english native userPreferred }
      coverImage { large medium color }
      averageScore
    }
  }
}
`;

const NEXT_SEASON_MEDIA_QUERY = `
query ($startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, startDate_greater: $startDateGreater, startDate_lesser: $startDateLesser, sort: FAVOURITES_DESC) {
      id
      title { romaji english native userPreferred }
      coverImage { large medium color }
      averageScore
      startDate { year month day }
    }
  }
}
`;

const RANKED_MEDIA_QUERY = `
query ($startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total }
    media(type: ANIME, startDate_greater: $startDateGreater, startDate_lesser: $startDateLesser, sort: SCORE_DESC) {
      id
      title { romaji english native userPreferred }
      coverImage { large medium color }
      averageScore
    }
  }
}
`;

function getWeekRange(): { startDate: number; endDate: number } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    startDate: Math.floor(monday.getTime() / 1000),
    endDate: Math.floor(sunday.getTime() / 1000),
  };
}

export class HttpAnilistRepository implements AnimeRepository {
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
    const { startDate, endDate } = getWeekRange();
    const allSchedules = await this.fetchAiringSchedules(
      ctx,
      startDate,
      endDate,
    );

    const result = AnilistCalendarResponseSchema.safeParse({
      data: {
        Page: {
          pageInfo: { hasNextPage: false },
          airingSchedules: allSchedules,
        },
      },
    });
    if (!result.success) {
      throw new Error("AniList API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  private async fetchAiringSchedules(
    ctx: Context,
    startDate: number,
    endDate: number,
  ): Promise<unknown[]> {
    const allSchedules: unknown[] = [];
    let page = 1;
    let hasNextPage = true;
    while (hasNextPage) {
      const pageData = await this.fetchAiringSchedulePage(
        ctx,
        startDate,
        endDate,
        page,
      );
      allSchedules.push(...pageData.airingSchedules);
      hasNextPage = pageData.hasNextPage;
      page++;
    }
    return allSchedules;
  }

  private async fetchAiringSchedulePage(
    ctx: Context,
    startDate: number,
    endDate: number,
    page: number,
  ): Promise<{ hasNextPage: boolean; airingSchedules: unknown[] }> {
    const response = await this.client.request(ANILIST_ENDPOINT, {
      ctx,
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: AIRING_SCHEDULE_QUERY,
        variables: { startDate, endDate, page },
      }),
    });
    const pageData: unknown = await response.json();

    const result = AnilistResponseSchema.safeParse(pageData);
    if (!result.success) {
      throw new Error("AniList API response structure mismatch", {
        cause: result.error,
      });
    }

    return {
      hasNextPage: result.data.data.Page.pageInfo.hasNextPage,
      airingSchedules: result.data.data.Page.airingSchedules,
    };
  }

  private async graphqlRequest(
    ctx: Context,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await this.client.request(ANILIST_ENDPOINT, {
      ctx,
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    return await response.json();
  }

  @Cached({
    ttl: new Duration({ days: 1 }),
    excludeArgs: [0],
  })
  async getRankedSubjects(
    ctx: Context,
    params: Parameters<AnimeRepository["getRankedSubjects"]>[1],
  ): Promise<RankedSubjectsPage> {
    const startDateGreater = params.year * 10000 + params.month * 100 + 1;
    const startDateLesser = params.year * 10000 + params.month * 100 + 31;

    const data = await this.graphqlRequest(ctx, RANKED_MEDIA_QUERY, {
      startDateGreater,
      startDateLesser,
      page: 1,
      perPage: 20,
    });

    const result = AnilistRankedResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Anilist ranked response structure mismatch", {
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
    const data = await this.graphqlRequest(ctx, MEDIA_DETAIL_QUERY, {
      id: Number(subjectId),
    });
    const result = AnilistSubjectResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("AniList subject response structure mismatch", {
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
    _offset: number,
    _limit: number,
  ): Promise<AnimeEpisodesPage> {
    const data = await this.graphqlRequest(ctx, MEDIA_EPISODES_QUERY, {
      id: Number(subjectId),
    });
    const result = AnilistEpisodesResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("AniList episodes response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  @Cached({
    ttl: new Duration({ days: 30 }),
    excludeArgs: [0],
  })
  async getSubjectPersons(
    ctx: Context,
    subjectId: string,
  ): Promise<AnimePerson[]> {
    const data = await this.graphqlRequest(ctx, MEDIA_STAFF_QUERY, {
      id: Number(subjectId),
    });
    const result = AnilistStaffResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("AniList staff response structure mismatch", {
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
    const data = await this.graphqlRequest(ctx, MEDIA_CHARACTERS_QUERY, {
      id: Number(subjectId),
    });
    const result = AnilistCharactersResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("AniList characters response structure mismatch", {
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
    const page = Math.floor(params.offset / params.limit) + 1;
    const data = await this.graphqlRequest(ctx, SEARCH_MEDIA_QUERY, {
      search: params.keyword,
      page,
      perPage: params.limit,
    });
    const result = AnilistSearchResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Anilist search response structure mismatch", {
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
    const page = Math.floor(params.offset / params.limit) + 1;
    const startDateGreater = params.year * 10000 + params.month * 100 + 1;
    const startDateLesser = params.year * 10000 + params.month * 100 + 31;

    const data = await this.graphqlRequest(ctx, NEXT_SEASON_MEDIA_QUERY, {
      page,
      perPage: params.limit,
      startDateGreater,
      startDateLesser,
    });
    const result = AnilistNextSeasonResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Anilist next season response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }
}
