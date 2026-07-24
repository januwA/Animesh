import type { CollectionRepository } from "@/domain/collection/CollectionRepository";

export class RemoveFavoriteUseCase {
	constructor(private readonly repo: CollectionRepository) {}

	execute(subjectId: number): void {
		this.repo.remove(subjectId);
	}
}
