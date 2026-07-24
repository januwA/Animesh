import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import type {
	CollectionsState,
	FavoriteItem,
} from "@/domain/collection/CollectionSchemas";
import {
	COLLECTION_STORAGE_KEY,
	CollectionsStateSchema,
} from "@/domain/collection/CollectionSchemas";

function loadState(): CollectionsState {
	try {
		const serialized = localStorage.getItem(COLLECTION_STORAGE_KEY);
		if (!serialized) {
			return { items: [], lastUpdatedAt: Date.now() };
		}

		const parsed: unknown = JSON.parse(serialized);
		const result = CollectionsStateSchema.safeParse(parsed);
		if (result.success) {
			return result.data;
		}

		localStorage.removeItem(COLLECTION_STORAGE_KEY);
		return { items: [], lastUpdatedAt: Date.now() };
	} catch {
		return { items: [], lastUpdatedAt: Date.now() };
	}
}

function saveState(state: CollectionsState): void {
	localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(state));
}

export class LocalStorageCollectionRepository implements CollectionRepository {
	getAll(): FavoriteItem[] {
		return loadState().items;
	}

	isFavorited(subjectId: number): boolean {
		return loadState().items.some((item) => item.subjectId === subjectId);
	}

	add(item: Omit<FavoriteItem, "addedAt">): void {
		const state = loadState();
		if (state.items.some((i) => i.subjectId === item.subjectId)) {
			return;
		}
		state.items.push({ ...item, addedAt: Date.now() });
		state.lastUpdatedAt = Date.now();
		saveState(state);
	}

	remove(subjectId: number): void {
		const state = loadState();
		state.items = state.items.filter((i) => i.subjectId !== subjectId);
		state.lastUpdatedAt = Date.now();
		saveState(state);
	}
}
