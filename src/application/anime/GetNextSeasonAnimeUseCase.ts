import type { Context } from "ajanuw-context";
import type {
  AnimeRepository,
  NextSeasonSubjectsPage,
  NextSeasonSubjectsParams,
} from "../../domain/anime/AnimeRepository";

export interface NextSeasonTabItem {
  month: number;
  label: string;
}

export interface NextSeasonInfo {
  year: number;
  season: string;
  months: number[];
  tabs: NextSeasonTabItem[];
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
  let year = now.getFullYear();
  let season = SEASON_NAMES.spring;
  let months = [4, 5, 6];

  if (month <= 3) {
    year = now.getFullYear();
    season = SEASON_NAMES.spring;
    months = [4, 5, 6];
  } else if (month <= 6) {
    year = now.getFullYear();
    season = SEASON_NAMES.summer;
    months = [7, 8, 9];
  } else if (month <= 9) {
    year = now.getFullYear();
    season = SEASON_NAMES.fall;
    months = [10, 11, 12];
  } else {
    year = now.getFullYear() + 1;
    season = SEASON_NAMES.winter;
    months = [1, 2, 3];
  }

  const tabs: NextSeasonTabItem[] = months.map((m) => ({
    month: m,
    label: MONTH_LABELS[m],
  }));

  return { year, season, months, tabs };
}

export class GetNextSeasonAnimeUseCase {
  constructor(private readonly animeRepository: AnimeRepository) {}

  execute(
    ctx: Context,
    params: NextSeasonSubjectsParams,
  ): Promise<NextSeasonSubjectsPage> {
    return this.animeRepository.getNextSeasonSubjects(ctx, params);
  }
}
