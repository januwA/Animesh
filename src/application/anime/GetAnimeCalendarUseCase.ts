import type { Context } from "ajanuw-context";
import type { AnimeCache } from "@/domain/anime/AnimeCache";
import type { AnimeCalendarDay } from "@/domain/anime/AnimeSchemas";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export class GetAnimeCalendarUseCase {
  constructor(
    private readonly animeRepository: AnimeRepository,
    private readonly animeCache: AnimeCache,
  ) {}

  async execute(ctx: Context): Promise<AnimeCalendarDay[]> {
    const cached = await this.animeCache.getCalendar(ctx);
    if (cached) {
      return cached;
    }
    const calendar = await this.animeRepository.getCalendar(ctx);
    await this.animeCache.setCalendar(ctx, calendar);
    return calendar;
  }
}
