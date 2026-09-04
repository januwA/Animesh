import type { Context } from "ajanuw-context";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";

export class RemoveFavoriteUseCase {
  constructor(private readonly repo: CollectionRepository) {}

  async execute(
    ctx: Context,
    params: { subjectId: number; platform: AnimePlatform },
  ): Promise<void> {
    await this.repo.remove(ctx, params.subjectId, params.platform);
  }
}
