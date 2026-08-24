import type { Context } from "ajanuw-context";
import type {
  AnimeRepository,
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
import type { HttpClient } from "../http/HttpClient";
import {
  AnilistCalendarResponseSchema,
  AnilistCharactersResponseSchema,
  AnilistEpisodesResponseSchema,
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

function notImplemented(method: string): never {
  throw new Error(`AnilistRepository.${method} is not implemented`);
}

export class HttpAnilistRepository implements AnimeRepository {
  constructor(private readonly client: HttpClient) {}

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

    try {
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
    } catch (err: unknown) {
      if (ctx.err() && err === ctx.err()) {
        throw err;
      }
      throw new Error("Failed to fetch AniList calendar", { cause: err });
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

    return (
      pageData as {
        data: {
          Page: {
            hasNextPage: boolean;
            airingSchedules: unknown[];
          };
        };
      }
    ).data.Page;
  }

  private async graphqlRequest(
    ctx: Context,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    try {
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
    } catch (err: unknown) {
      if (ctx.err() && err === ctx.err()) {
        throw err;
      }
      throw new Error("Failed to fetch AniList data", { cause: err });
    }
  }

  getRankedSubjects(
    _ctx: Context,
    _year: number,
    _month: number,
    _limit?: number,
    _offset?: number,
  ): Promise<RankedSubjectsPage> {
    notImplemented("getRankedSubjects");
  }

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

  searchSubjects(
    _ctx: Context,
    _params: AnimeSubjectSearchParams,
  ): Promise<AnimeSubjectSearchResult> {
    notImplemented("searchSubjects");
  }
}
