import type { Context } from "ajanuw-context";
import type { AnimeRelatedSubject } from "@/domain/anime/AnimeSchemas";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export class GetRelatedSubjectsUseCase {
  constructor(private readonly animeRepository: AnimeRepository) {}

  async execute(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimeRelatedSubject[]> {
    return this.animeRepository.getRelatedSubjects(ctx, subjectId);
  }
}
