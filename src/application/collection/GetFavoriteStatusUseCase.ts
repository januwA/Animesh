import type { CollectionRepository } from "@/domain/collection/CollectionRepository";

export class GetFavoriteStatusUseCase {
	constructor(private readonly repo: CollectionRepository) {}

	execute(subjectId: number): boolean {
		return this.repo.isFavorited(subjectId);
	}
}
