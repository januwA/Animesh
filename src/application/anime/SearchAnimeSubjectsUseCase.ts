import type { Context } from "ajanuw-context";
import type {
  AnimeSubjectSearchParams,
  AnimeSubjectSearchResult,
} from "@/domain/anime/AnimeSchemas";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export class SearchAnimeSubjectsUseCase {
  constructor(private readonly animeRepository: AnimeRepository) {}

  async execute(
    ctx: Context,
    params: AnimeSubjectSearchParams,
  ): Promise<AnimeSubjectSearchResult> {
    return this.animeRepository.searchSubjects(ctx, params);
  }
}
