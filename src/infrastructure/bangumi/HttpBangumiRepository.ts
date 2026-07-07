import type { Context } from "../../crosscutting/context/interface";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import {
	type BangumiCalendarDay,
	BangumiCalendarResponseSchema,
	type BangumiEpisode,
	BangumiEpisodesResponseSchema,
	type BangumiSubject,
	BangumiSubjectSchema,
} from "../../domain/bangumi/BangumiSchemas";
import type { HttpClient } from "../http/HttpClient";

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
	): Promise<BangumiEpisode[]> {
		let data: unknown;
		try {
			data = await this.client.getJson<{ data: BangumiEpisode[] }>(
				`https://api.bgm.tv/v0/episodes?subject_id=${subjectId}&limit=100`,
				{ ctx },
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
		return result.data.data;
	}
}
