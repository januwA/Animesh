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
/**
 * Person/Staff schema — represents a staff member or organization
 * involved in the subject production.
 * API: https://api.bgm.tv/v0/subjects/{subject_id}/persons
 */
export const BangumiPersonImageSchema = z.object({
	small: z.string(),
	grid: z.string(),
	large: z.string(),
	medium: z.string(),
});

export const BangumiPersonSchema = z.object({
	id: z.number(),
	name: z.string(),
	relation: z.string(),
	career: z.array(z.string()),
	type: z.number(),
	eps: z.string(),
	images: BangumiPersonImageSchema,
});

/**
 * Actor/Voice actor schema — nested inside character data.
 */
export const BangumiActorImageSchema = z.object({
	small: z.string(),
	grid: z.string(),
	large: z.string(),
	medium: z.string(),
});

export const BangumiActorSchema = z.object({
	id: z.number(),
	name: z.string(),
	images: BangumiActorImageSchema,
	short_summary: z.string(),
	career: z.array(z.string()),
	type: z.number(),
	locked: z.boolean(),
});

/**
 * Character schema — represents a character appearing in the subject.
 * API: https://api.bgm.tv/v0/subjects/{subject_id}/characters
 */
export const BangumiCharacterSchema = z.object({
	id: z.number(),
	name: z.string(),
	images: BangumiPersonImageSchema,
	summary: z.string(),
	relation: z.string(),
	type: z.number(),
	actors: z.array(BangumiActorSchema),
});

export const BangumiPersonsResponseSchema = z.array(BangumiPersonSchema);
export const BangumiCharactersResponseSchema = z.array(BangumiCharacterSchema);

export type BangumiPerson = z.infer<typeof BangumiPersonSchema>;
export type BangumiActor = z.infer<typeof BangumiActorSchema>;
export type BangumiCharacter = z.infer<typeof BangumiCharacterSchema>;
export type BangumiEpisode = z.infer<typeof BangumiEpisodeSchema>;
export type BangumiEpisodesResponse = z.infer<
	typeof BangumiEpisodesResponseSchema
>;
