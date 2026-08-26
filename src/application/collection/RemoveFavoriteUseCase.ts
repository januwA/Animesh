import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";

export class RemoveFavoriteUseCase {
  constructor(private readonly repo: CollectionRepository) {}

  async execute(subjectId: number, platform: AnimePlatform): Promise<void> {
    await this.repo.remove(subjectId, platform);
  }
}
