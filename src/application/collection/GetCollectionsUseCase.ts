import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";

export class GetCollectionsUseCase {
  constructor(private readonly repo: CollectionRepository) {}

  async execute(): Promise<FavoriteItem[]> {
    return this.repo.getAll();
  }
}
