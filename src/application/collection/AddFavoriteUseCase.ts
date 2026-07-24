import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";

export class AddFavoriteUseCase {
	constructor(private readonly repo: CollectionRepository) {}

	execute(item: Omit<FavoriteItem, "addedAt">): void {
		this.repo.add(item);
	}
}
