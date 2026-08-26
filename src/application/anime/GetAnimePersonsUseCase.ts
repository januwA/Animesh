import type { Context } from "ajanuw-context";
import type { AnimeCache } from "@/domain/anime/AnimeCache";
import type { AnimePerson } from "@/domain/anime/AnimeSchemas";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export class GetAnimePersonsUseCase {
  constructor(
    private readonly animeRepository: AnimeRepository,
    private readonly animeCache: AnimeCache,
  ) {}

  async execute(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimePerson[]> {
    const cached = await this.animeCache.getPersons(ctx, subjectId);
    if (cached) {
      return cached;
    }
    const persons = await this.animeRepository.getSubjectPersons(
      ctx,
      subjectId,
    );
    await this.animeCache.setPersons(ctx, subjectId, persons);
    return persons;
  }
}
