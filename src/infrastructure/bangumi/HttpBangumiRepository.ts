import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import {
	type BangumiCalendarDay,
	BangumiCalendarResponseSchema,
	type BangumiEpisode,
	BangumiEpisodesResponseSchema,
	type BangumiSubject,
	BangumiSubjectSchema,
} from "../../domain/bangumi/BangumiSchemas";
import type { Context } from "../../shared/context/interface";

const BANGUMI_CALENDAR_URL = "https://api.bgm.tv/calendar";

export class HttpBangumiRepository implements BangumiRepository {
	async getCalendar(ctx: Context): Promise<BangumiCalendarDay[]> {
		const controller = new AbortController();

		if (ctx.err()) {
			throw ctx.err();
		}
		ctx.done().then(() => {
			controller.abort(ctx.err() || undefined);
		});

		const response = await fetch(BANGUMI_CALENDAR_URL, {
			signal: controller.signal,
			headers: {
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch calendar: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();
		const result = BangumiCalendarResponseSchema.safeParse(data);
		if (!result.success) {
			throw new Error("Calendar API response structure mismatch", {
				cause: result.error,
			});
		}

		return result.data;
	}

	async getSubject(ctx: Context, subjectId: string): Promise<BangumiSubject> {
		const controller = new AbortController();

		if (ctx.err()) {
			throw ctx.err();
		}
		ctx.done().then(() => {
			controller.abort(ctx.err() || undefined);
		});

		const response = await fetch(
			`https://api.bgm.tv/v0/subjects/${subjectId}`,
			{
				signal: controller.signal,
				headers: {
					Accept: "application/json",
				},
			},
		);

		if (!response.ok) {
			throw new Error(
				`Failed to fetch subject detail: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();
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
		const controller = new AbortController();

		if (ctx.err()) {
			throw ctx.err();
		}
		ctx.done().then(() => {
			controller.abort(ctx.err() || undefined);
		});

		const response = await fetch(
			`https://api.bgm.tv/v0/episodes?subject_id=${subjectId}&limit=100`,
			{
				signal: controller.signal,
				headers: {
					Accept: "application/json",
				},
			},
		);

		if (!response.ok) {
			throw new Error(
				`Failed to fetch episodes: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();
		const result = BangumiEpisodesResponseSchema.safeParse(data);
		if (!result.success) {
			throw new Error("Episodes API response structure mismatch", {
				cause: result.error,
			});
		}

		return result.data.data;
	}
}
