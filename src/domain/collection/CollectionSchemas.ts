import { z } from "zod";

export const COLLECTION_STORAGE_KEY = "animesh:collections";

export const FavoriteItemSchema = z.object({
	subjectId: z.number(),
	name: z.string(),
	nameCn: z.string(),
	imageUrl: z.string().nullable(),
	rating: z.number().nullable(),
	platform: z.string().nullable(),
	date: z.string().nullable(),
	summary: z.string().nullable(),
	addedAt: z.number(),
});

export type FavoriteItem = z.infer<typeof FavoriteItemSchema>;

export const CollectionsStateSchema = z.object({
	items: z.array(FavoriteItemSchema),
	lastUpdatedAt: z.number(),
});

export type CollectionsState = z.infer<typeof CollectionsStateSchema>;
