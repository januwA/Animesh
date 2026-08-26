import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";

export class GetFavoriteStatusUseCase {
  constructor(private readonly repo: CollectionRepository) {}

  async execute(subjectId: number, platform: AnimePlatform): Promise<boolean> {
    return this.repo.isFavorited(subjectId, platform);
  }
}
