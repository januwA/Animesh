import type { Context } from "ajanuw-context";
import type { AnimeCache } from "@/domain/anime/AnimeCache";
import type { AnimeEpisodesPage } from "@/domain/anime/AnimeSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export interface GetEpisodesPageCommand {
  subjectId: string;
  offset: number;
  limit: number;
}

export class GetAnimeEpisodesUseCase {
  constructor(
    private readonly animeRepository: AnimeRepository,
    private readonly animeCache: AnimeCache,
  ) {}

  async execute(
    ctx: Context,
    command: GetEpisodesPageCommand,
  ): Promise<AnimeEpisodesPage> {
    const { subjectId, offset, limit } = command;
    const cached = await this.animeCache.getEpisodes(
      ctx,
      NonEmptyStringSchema.parse(subjectId),
      offset,
      limit,
    );
    if (cached) {
      return cached;
    }
    const page = await this.animeRepository.getEpisodes(
      ctx,
      NonEmptyStringSchema.parse(subjectId),
      offset,
      limit,
    );
    await this.animeCache.setEpisodes(
      ctx,
      NonEmptyStringSchema.parse(subjectId),
      offset,
      limit,
      page,
    );
    return page;
  }
}
