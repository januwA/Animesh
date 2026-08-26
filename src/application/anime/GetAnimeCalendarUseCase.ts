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
    const sorted = calendar.map((day) => ({
      ...day,
      items: [...day.items].sort((a, b) => {
        if (a.rating === 0) return 1;
        if (b.rating === 0) return -1;
        return b.rating - a.rating;
      }),
    }));
    await this.animeCache.setCalendar(ctx, sorted);
    return sorted;
  }
}
