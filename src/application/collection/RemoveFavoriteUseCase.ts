import type { CollectionRepository } from "@/domain/collection/CollectionRepository";

export class RemoveFavoriteUseCase {
  constructor(private readonly repo: CollectionRepository) {}

  async execute(subjectId: number): Promise<void> {
    await this.repo.remove(subjectId);
  }
}
