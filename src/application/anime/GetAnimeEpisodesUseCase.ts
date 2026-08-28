import type { Context } from "ajanuw-context";
import type { AnimeEpisodesPage } from "@/domain/anime/AnimeSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export interface GetEpisodesPageCommand {
  subjectId: string;
  offset: number;
  limit: number;
}

export class GetAnimeEpisodesUseCase {
  constructor(private readonly animeRepository: AnimeRepository) {}

  async execute(
    ctx: Context,
    command: GetEpisodesPageCommand,
  ): Promise<AnimeEpisodesPage> {
    const { subjectId, offset, limit } = command;
    return this.animeRepository.getEpisodes(
      ctx,
      NonEmptyStringSchema.parse(subjectId),
      offset,
      limit,
    );
  }
}
