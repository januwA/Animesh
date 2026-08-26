import type { Context } from "ajanuw-context";
import type { AnimeCache } from "@/domain/anime/AnimeCache";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export class GetAnimeSubjectUseCase {
  constructor(
    private readonly animeRepository: AnimeRepository,
    private readonly animeCache: AnimeCache,
  ) {}

  async execute(
    ctx: Context,
    subjectId: NonEmptyString,
  ): Promise<AnimeSubject> {
    const cached = await this.animeCache.getSubject(ctx, subjectId);
    if (cached) {
      return cached;
    }
    const subject = await this.animeRepository.getSubject(ctx, subjectId);
    await this.animeCache.setSubject(ctx, subjectId, subject);
    return subject;
  }
}
