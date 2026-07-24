import type { FavoriteItem } from "./CollectionSchemas";

export interface CollectionRepository {
	getAll(): FavoriteItem[];
	isFavorited(subjectId: number): boolean;
	add(item: Omit<FavoriteItem, "addedAt">): void;
	remove(subjectId: number): void;
}
