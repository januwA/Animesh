import type { Context } from "ajanuw-context";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";

export class AddFavoriteUseCase {
  constructor(private readonly repo: CollectionRepository) {}

  async execute(
    ctx: Context,
    item: Omit<FavoriteItem, "addedAt">,
  ): Promise<void> {
    await this.repo.add(ctx, item);
  }
}
