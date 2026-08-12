import type { CollectionRepository } from "@/domain/collection/CollectionRepository";

export class GetFavoriteStatusUseCase {
  constructor(private readonly repo: CollectionRepository) {}

  async execute(subjectId: number): Promise<boolean> {
    return this.repo.isFavorited(subjectId);
  }
}
