import type { Context } from "ajanuw-context";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export class GetAnimeSubjectUseCase {
  constructor(private readonly animeRepository: AnimeRepository) {}

  async execute(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimeSubject> {
    return this.animeRepository.getSubject(ctx, subjectId);
  }
}
