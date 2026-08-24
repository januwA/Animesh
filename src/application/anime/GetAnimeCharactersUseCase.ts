import type { Context } from "ajanuw-context";
import type { AnimeCache } from "@/domain/anime/AnimeCache";
import type { AnimeCharacter } from "@/domain/anime/AnimeSchemas";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export class GetAnimeCharactersUseCase {
  constructor(
    private readonly animeRepository: AnimeRepository,
    private readonly animeCache: AnimeCache,
  ) {}

  async execute(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimeCharacter[]> {
    const cached = await this.animeCache.getCharacters(ctx, subjectId);
    if (cached) {
      return cached;
    }
    const characters = await this.animeRepository.getSubjectCharacters(
      ctx,
      subjectId,
    );
    await this.animeCache.setCharacters(ctx, subjectId, characters);
    return characters;
  }
}
