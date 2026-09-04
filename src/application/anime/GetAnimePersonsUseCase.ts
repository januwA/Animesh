import type { Context } from "ajanuw-context";
import type { AnimePerson } from "@/domain/anime/AnimeSchemas";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export class GetAnimePersonsUseCase {
  constructor(private readonly animeRepository: AnimeRepository) {}

  async execute(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimePerson[]> {
    return this.animeRepository.getSubjectPersons(ctx, subjectId);
  }
}
