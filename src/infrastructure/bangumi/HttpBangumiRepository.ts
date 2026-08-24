import type { Context } from "ajanuw-context";
import type {
  BangumiCalendarDay,
  BangumiCharacter,
  BangumiEpisodesPage,
  BangumiPerson,
  BangumiSubject,
  BangumiSubjectSearchParams,
  BangumiSubjectSearchResult,
} from "@/domain/bangumi/BangumiSchemas";
import type {
  BangumiRepository,
  RankedSubjectsPage,
} from "../../domain/bangumi/BangumiRepository";
import type { HttpClient } from "../http/HttpClient";
import {
  BangumiCalendarResponseSchema,
  BangumiCharactersResponseSchema,
  BangumiEpisodesResponseSchema,
  BangumiPersonsResponseSchema,
  BangumiRankedSubjectsResponseSchema,
  BangumiSubjectSchema,
  BangumiSubjectSearchResponseSchema,
} from "./BangumiSchemas";

export class HttpBangumiRepository implements BangumiRepository {
  constructor(private readonly client: HttpClient) {}

  async getCalendar(ctx: Context): Promise<BangumiCalendarDay[]> {
    let data: unknown;
    try {
      data = await this.client.getJson<unknown>("https://api.bgm.tv/calendar", {
        ctx,
      });
    } catch (err: unknown) {
      if (ctx.err() && err === ctx.err()) {
        throw err;
      }
      throw new Error("Failed to fetch calendar", { cause: err });
    }

    const result = BangumiCalendarResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Calendar API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async getRankedSubjects(
    ctx: Context,
    year: number,
    month: number,
    limit?: number,
    offset?: number,
  ): Promise<RankedSubjectsPage> {
    let data: unknown;
    try {
      data = await this.client.getJson<unknown>(
        "https://api.bgm.tv/v0/subjects",
        {
          ctx,
          params: {
            type: "2",
            cat: "1",
            sort: "rank",
            year,
            month,
            limit,
            offset,
          },
        },
      );
    } catch (err: unknown) {
      if (ctx.err() && err === ctx.err()) {
        throw err;
      }
      throw new Error("Failed to fetch ranked subjects", { cause: err });
    }

    const result = BangumiRankedSubjectsResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Ranked subjects API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async getSubject(ctx: Context, subjectId: string): Promise<BangumiSubject> {
    let data: unknown;
    try {
      data = await this.client.getJson<unknown>(
        `https://api.bgm.tv/v0/subjects/${subjectId}`,
        { ctx },
      );
    } catch (err: unknown) {
      if (ctx.err() && err === ctx.err()) {
        throw err;
      }
      throw new Error("Failed to fetch subject detail", { cause: err });
    }

    const result = BangumiSubjectSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Subject API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async getEpisodes(
    ctx: Context,
    subjectId: string,
    offset: number,
    limit: number,
  ): Promise<BangumiEpisodesPage> {
    let data: unknown;
    try {
      data = await this.client.getJson<unknown>(
        "https://api.bgm.tv/v0/episodes",
        { ctx, params: { subject_id: subjectId, limit, offset } },
      );
    } catch (err: unknown) {
      if (ctx.err() && err === ctx.err()) {
        throw err;
      }
      throw new Error("Failed to fetch episodes", { cause: err });
    }

    const result = BangumiEpisodesResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Episodes API response structure mismatch", {
        cause: result.error,
      });
    }
    return { items: result.data.data, total: result.data.total };
  }

  async getSubjectPersons(
    ctx: Context,
    subjectId: string,
  ): Promise<BangumiPerson[]> {
    let data: unknown;
    try {
      data = await this.client.getJson<unknown>(
        `https://api.bgm.tv/v0/subjects/${subjectId}/persons`,
        { ctx, params: { subject_id: subjectId } },
      );
    } catch (err: unknown) {
      if (ctx.err() && err === ctx.err()) {
        throw err;
      }
      throw new Error("Failed to fetch subject persons", { cause: err });
    }

    const result = BangumiPersonsResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Persons API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async getSubjectCharacters(
    ctx: Context,
    subjectId: string,
  ): Promise<BangumiCharacter[]> {
    let data: unknown;
    try {
      data = await this.client.getJson<unknown>(
        `https://api.bgm.tv/v0/subjects/${subjectId}/characters`,
        { ctx, params: { subject_id: subjectId } },
      );
    } catch (err: unknown) {
      if (ctx.err() && err === ctx.err()) {
        throw err;
      }
      throw new Error("Failed to fetch subject characters", { cause: err });
    }

    const result = BangumiCharactersResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("Characters API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async searchSubjects(
    ctx: Context,
    params: BangumiSubjectSearchParams,
  ): Promise<BangumiSubjectSearchResult> {
    let raw: unknown;
    try {
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
      raw = await response.json();
    } catch (err: unknown) {
      if (ctx.err() && err === ctx.err()) {
        throw err;
      }
      throw new Error("Failed to search subjects", { cause: err });
    }

    const result = BangumiSubjectSearchResponseSchema.safeParse(raw);
    if (!result.success) {
      throw new Error("Subject search API response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }
}
