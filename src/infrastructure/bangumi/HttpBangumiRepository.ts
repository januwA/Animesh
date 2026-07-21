import type { Context } from "ajanuw-context";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import {
	type BangumiCalendarDay,
	BangumiCalendarResponseSchema,
	type BangumiCharacter,
	BangumiCharactersResponseSchema,
	type BangumiEpisode,
	BangumiEpisodesResponseSchema,
	type BangumiPerson,
	BangumiPersonsResponseSchema,
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

	async getSubjectPersons(
		ctx: Context,
		subjectId: string,
	): Promise<BangumiPerson[]> {
		let data: unknown;
		try {
			data = await this.client.getJson<unknown>(
				`https://api.bgm.tv/v0/subjects/${subjectId}/persons?subject_id=${subjectId}`,
				{ ctx },
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
				`https://api.bgm.tv/v0/subjects/${subjectId}/characters?subject_id=${subjectId}`,
				{ ctx },
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
}
