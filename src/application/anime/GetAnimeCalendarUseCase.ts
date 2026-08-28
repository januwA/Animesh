import type { Context } from "ajanuw-context";
import type { AnimeCalendarDay } from "@/domain/anime/AnimeSchemas";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export class GetAnimeCalendarUseCase {
  constructor(private readonly animeRepository: AnimeRepository) {}

  async execute(ctx: Context): Promise<AnimeCalendarDay[]> {
    const calendar = await this.animeRepository.getCalendar(ctx);
    return calendar.map((day) => ({
      ...day,
      items: [...day.items].sort((a, b) => {
        if (a.rating === 0) return 1;
        if (b.rating === 0) return -1;
        return b.rating - a.rating;
      }),
    }));
  }
}
