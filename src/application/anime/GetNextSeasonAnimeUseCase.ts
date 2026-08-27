import type { Context } from "ajanuw-context";
import type { AnimeCache } from "@/domain/anime/AnimeCache";
import type {
  AnimeCalendarItem,
  AnimeSubject,
  NextSeasonData,
  NextSeasonMonthGroup,
} from "@/domain/anime/AnimeSchemas";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

export interface NextSeasonInfo {
  year: number;
  season: string;
  months: number[];
}

const SEASON_NAMES: Record<string, string> = {
  winter: "冬",
  spring: "春",
  summer: "夏",
  fall: "秋",
};

const MONTH_LABELS: Record<number, string> = {
  1: "1月",
  2: "2月",
  3: "3月",
  4: "4月",
  5: "5月",
  6: "6月",
  7: "7月",
  8: "8月",
  9: "9月",
  10: "10月",
  11: "11月",
  12: "12月",
};

export function getNextSeasonInfo(now: Date): NextSeasonInfo {
  const month = now.getMonth() + 1;
  if (month <= 3) {
    return {
      year: now.getFullYear(),
      season: SEASON_NAMES.spring,
      months: [4, 5, 6],
    };
  }
  if (month <= 6) {
    return {
      year: now.getFullYear(),
      season: SEASON_NAMES.summer,
      months: [7, 8, 9],
    };
  }
  if (month <= 9) {
    return {
      year: now.getFullYear(),
      season: SEASON_NAMES.fall,
      months: [10, 11, 12],
    };
  }
  return {
    year: now.getFullYear() + 1,
    season: SEASON_NAMES.winter,
    months: [1, 2, 3],
  };
}

function groupByMonth(
  subjects: AnimeSubject[],
  months: number[],
): NextSeasonMonthGroup[] {
  const groups = new Map<number, AnimeCalendarItem[]>();

  for (const month of months) {
    groups.set(month, []);
  }

  for (const subject of subjects) {
    const dateStr = subject.date;
    if (!dateStr || typeof dateStr !== "string") continue;

    const match = dateStr.match(/^(\d{4})-(\d{2})/);
    if (!match) continue;

    const subjectMonth = Number(match[2]);
    const items = groups.get(subjectMonth);
    if (!items) continue;

    if (!items.some((item) => item.id === subject.id)) {
      items.push({
        id: subject.id as number,
        name: subject.name as string,
        image: subject.image as string,
        rating: subject.rating as number,
      });
    }
  }

  return months.map((month) => ({
    month,
    label: MONTH_LABELS[month],
    /* v8 ignore next -- groups 始终包含所有 months 键 */
    items: groups.get(month) ?? [],
  }));
}

export class GetNextSeasonAnimeUseCase {
  constructor(
    private readonly animeRepository: AnimeRepository,
    private readonly animeCache: AnimeCache,
  ) {}

  async execute(ctx: Context): Promise<{
    info: NextSeasonInfo;
    data: NextSeasonData;
  }> {
    const info = getNextSeasonInfo(new Date());

    const cached = await this.animeCache.getNextSeason(
      ctx,
      info.year,
      info.months,
    );
    if (cached) {
      return { info, data: groupByMonth(cached, info.months) };
    }

    const subjects = await this.animeRepository.getNextSeasonSubjects(
      ctx,
      info.year,
      info.months,
    );

    await this.animeCache.setNextSeason(ctx, info.year, info.months, subjects);

    return { info, data: groupByMonth(subjects, info.months) };
  }
}
