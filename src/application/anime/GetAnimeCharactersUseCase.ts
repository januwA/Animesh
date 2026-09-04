import type { Context } from "ajanuw-context";
import type { AnimeCharacter } from "@/domain/anime/AnimeSchemas";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export class GetAnimeCharactersUseCase {
  constructor(private readonly animeRepository: AnimeRepository) {}

  async execute(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimeCharacter[]> {
    return this.animeRepository.getSubjectCharacters(ctx, subjectId);
  }
}
