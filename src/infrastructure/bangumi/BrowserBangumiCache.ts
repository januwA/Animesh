import type { Context } from "ajanuw-context";
import { z } from "zod";
import type { BangumiCache } from "@/domain/bangumi/BangumiCache";
import {
	type BangumiCalendarDay,
	BangumiCalendarResponseSchema,
	type BangumiCharacter,
	BangumiCharactersResponseSchema,
	type BangumiEpisode,
	BangumiEpisodeSchema,
	type BangumiPerson,
	BangumiPersonsResponseSchema,
	type BangumiSubject,
	BangumiSubjectSchema,
} from "@/domain/bangumi/BangumiSchemas";

const CacheEnvelopeSchema = z.object({
	data: z.unknown(),
	expiry: z.number(),
});

function getItem<T>(key: string, schema: z.ZodType<T>): T | null {
	try {
		const serialized = localStorage.getItem(key);
		if (!serialized) {
			return null;
		}

		const parsed: unknown = JSON.parse(serialized);
		const envelopeResult = CacheEnvelopeSchema.safeParse(parsed);
		if (!envelopeResult.success) {
			localStorage.removeItem(key);
			return null;
		}

		const { data, expiry } = envelopeResult.data;
		if (Date.now() > expiry) {
			localStorage.removeItem(key);
			return null;
		}

		const validationResult = schema.safeParse(data);
		if (!validationResult.success) {
			localStorage.removeItem(key);
			return null;
		}

		return validationResult.data;
	} catch {
		return null;
	}
}

function setItem<T>(key: string, data: T, ttlMs: number): void {
	const entry = {
		data,
		expiry: Date.now() + ttlMs,
	};
	localStorage.setItem(key, JSON.stringify(entry));
}

export class BrowserBangumiCache implements BangumiCache {
	private readonly ttlMs = 12 * 60 * 60 * 1000; // 12 hours

	getCalendar(_ctx: Context): Promise<BangumiCalendarDay[] | null> {
		return Promise.resolve(
			getItem("bangumi:calendar", BangumiCalendarResponseSchema),
		);
	}

	setCalendar(_ctx: Context, calendar: BangumiCalendarDay[]): Promise<void> {
		setItem("bangumi:calendar", calendar, this.ttlMs);
		return Promise.resolve();
	}

	getSubject(_ctx: Context, subjectId: string): Promise<BangumiSubject | null> {
		return Promise.resolve(
			getItem(`bangumi:subject:${subjectId}`, BangumiSubjectSchema),
		);
	}

	setSubject(
		_ctx: Context,
		subjectId: string,
		subject: BangumiSubject,
	): Promise<void> {
		setItem(`bangumi:subject:${subjectId}`, subject, this.ttlMs);
		return Promise.resolve();
	}

	getEpisodes(
		_ctx: Context,
		subjectId: string,
	): Promise<BangumiEpisode[] | null> {
		return Promise.resolve(
			getItem(`bangumi:episodes:${subjectId}`, z.array(BangumiEpisodeSchema)),
		);
	}

	setEpisodes(
		_ctx: Context,
		subjectId: string,
		episodes: BangumiEpisode[],
	): Promise<void> {
		setItem(`bangumi:episodes:${subjectId}`, episodes, this.ttlMs);
		return Promise.resolve();
	}

	getPersons(
		_ctx: Context,
		subjectId: string,
	): Promise<BangumiPerson[] | null> {
		return Promise.resolve(
			getItem(`bangumi:persons:${subjectId}`, BangumiPersonsResponseSchema),
		);
	}

	setPersons(
		_ctx: Context,
		subjectId: string,
		persons: BangumiPerson[],
	): Promise<void> {
		setItem(`bangumi:persons:${subjectId}`, persons, this.ttlMs);
		return Promise.resolve();
	}

	getCharacters(
		_ctx: Context,
		subjectId: string,
	): Promise<BangumiCharacter[] | null> {
		return Promise.resolve(
			getItem(
				`bangumi:characters:${subjectId}`,
				BangumiCharactersResponseSchema,
			),
		);
	}

	setCharacters(
		_ctx: Context,
		subjectId: string,
		characters: BangumiCharacter[],
	): Promise<void> {
		setItem(`bangumi:characters:${subjectId}`, characters, this.ttlMs);
		return Promise.resolve();
	}
}
