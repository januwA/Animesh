import type { Context } from "ajanuw-context";
import { z } from "zod";
import type { BangumiCache } from "@/domain/bangumi/BangumiCache";
import {
	type BangumiCalendarDay,
	BangumiCalendarResponseSchema,
} from "@/domain/bangumi/BangumiSchemas";

const CacheEnvelopeSchema = z.object({
	data: z.unknown(),
	expiry: z.number(),
});

export class BrowserBangumiCache implements BangumiCache {
	private readonly cacheKey = "bangumi:calendar";
	private readonly ttlMs = 12 * 60 * 60 * 1000; // 12 hours

	async getCalendar(_ctx: Context): Promise<BangumiCalendarDay[] | null> {
		try {
			const serialized = localStorage.getItem(this.cacheKey);
			if (!serialized) {
				return null;
			}

			const parsed: unknown = JSON.parse(serialized);
			const envelopeResult = CacheEnvelopeSchema.safeParse(parsed);
			if (!envelopeResult.success) {
				localStorage.removeItem(this.cacheKey);
				return null;
			}

			const { data, expiry } = envelopeResult.data;
			if (Date.now() > expiry) {
				localStorage.removeItem(this.cacheKey);
				return null;
			}

			const validationResult = BangumiCalendarResponseSchema.safeParse(data);
			if (!validationResult.success) {
				localStorage.removeItem(this.cacheKey);
				return null;
			}

			return validationResult.data;
		} catch {
			return null;
		}
	}

	async setCalendar(
		_ctx: Context,
		calendar: BangumiCalendarDay[],
	): Promise<void> {
		const entry = {
			data: calendar,
			expiry: Date.now() + this.ttlMs,
		};
		localStorage.setItem(this.cacheKey, JSON.stringify(entry));
	}
}
