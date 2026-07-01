import { z } from "zod";

export const BangumiWeekdaySchema = z.object({
	en: z.string(),
	cn: z.string(),
	ja: z.string(),
	id: z.number(),
});

export const BangumiSubjectImagesSchema = z.object({
	large: z.string(),
	common: z.string(),
	medium: z.string(),
	small: z.string(),
	grid: z.string(),
});

export const BangumiSubjectRatingSchema = z.object({
	total: z.number(),
	score: z.number(),
});

export const BangumiCalendarItemSchema = z.object({
	id: z.number(),
	url: z.string(),
	name: z.string(),
	name_cn: z.string(),
	air_date: z.string(),
	air_weekday: z.number(),
	rating: BangumiSubjectRatingSchema.nullable().optional(),
	rank: z.number().nullable().optional(),
	images: BangumiSubjectImagesSchema.nullable().optional(),
	collection: z.object({ doing: z.number() }).nullable().optional(),
});

export const BangumiCalendarDaySchema = z.object({
	weekday: BangumiWeekdaySchema,
	items: z.array(BangumiCalendarItemSchema),
});

export const BangumiCalendarResponseSchema = z.array(BangumiCalendarDaySchema);

export type BangumiWeekday = z.infer<typeof BangumiWeekdaySchema>;
export type BangumiSubjectRating = z.infer<typeof BangumiSubjectRatingSchema>;
export type BangumiSubjectImages = z.infer<typeof BangumiSubjectImagesSchema>;
export type BangumiCalendarItem = z.infer<typeof BangumiCalendarItemSchema>;
export type BangumiCalendarDay = z.infer<typeof BangumiCalendarDaySchema>;
