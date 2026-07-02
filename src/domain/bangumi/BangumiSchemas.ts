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

export const BangumiSubjectSchema = z.object({
	id: z.number(),
	name: z.string(),
	name_cn: z.string(),
	summary: z.string().optional().nullable(),
	images: BangumiSubjectImagesSchema.nullable().optional(),
	rating: z
		.object({
			score: z.number(),
			rank: z.number().nullable().optional(),
			total: z.number().nullable().optional(),
		})
		.nullable()
		.optional(),
	collection: z
		.object({
			wish: z.number().optional().nullable(),
			collect: z.number().optional().nullable(),
			doing: z.number().optional().nullable(),
			on_hold: z.number().optional().nullable(),
			dropped: z.number().optional().nullable(),
		})
		.nullable()
		.optional(),
	date: z.string().nullable().optional(),
	eps: z.number().nullable().optional(),
	platform: z.string().nullable().optional(),
});

export const BangumiEpisodeSchema = z.object({
	id: z.number(),
	type: z.number(), // 0: 本篇, 1: SP, 2: OP, 3: ED, 4: 预告, 5: 其它
	sort: z.number(), // 集数
	name: z.string(),
	name_cn: z.string(),
	duration: z.string().optional().nullable(),
	airdate: z.string().optional().nullable(),
	desc: z.string().optional().nullable(),
});

export const BangumiEpisodesResponseSchema = z.object({
	data: z.array(BangumiEpisodeSchema),
	total: z.number(),
	limit: z.number(),
	offset: z.number(),
});

export type BangumiWeekday = z.infer<typeof BangumiWeekdaySchema>;
export type BangumiSubjectRating = z.infer<typeof BangumiSubjectRatingSchema>;
export type BangumiSubjectImages = z.infer<typeof BangumiSubjectImagesSchema>;
export type BangumiCalendarItem = z.infer<typeof BangumiCalendarItemSchema>;
export type BangumiCalendarDay = z.infer<typeof BangumiCalendarDaySchema>;
export type BangumiSubject = z.infer<typeof BangumiSubjectSchema>;
export type BangumiEpisode = z.infer<typeof BangumiEpisodeSchema>;
export type BangumiEpisodesResponse = z.infer<
	typeof BangumiEpisodesResponseSchema
>;
