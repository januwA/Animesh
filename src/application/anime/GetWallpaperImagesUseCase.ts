import type { Context } from "ajanuw-context";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";

/** 最终返回的榜单条目数 */
export const RANKED_SUBJECT_LIMIT = 10;
/** 榜单按最近月数拉取（本月 + 上月） */
export const RANKED_SUBJECT_MONTH_WINDOW = 2;

/**
 * 生成包含当前月在内的最近 count 个月份窗口。
 * 利用 Date 构造函数的月份归一化，自动处理跨年回绕（如 1 月的上月为上一年的 12 月）。
 */
export function recentMonthWindows(
  count: number,
  now: Date,
): Array<{ year: number; month: number }> {
  const windows: Array<{ year: number; month: number }> = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    windows.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
  }
  return windows;
}

export class GetWallpaperImagesUseCase {
  constructor(private readonly animeRepository: AnimeRepository) {}

  async execute(ctx: Context): Promise<AnimeSubject[]> {
    const subjects: AnimeSubject[] = [];
    for (const { year, month } of recentMonthWindows(
      RANKED_SUBJECT_MONTH_WINDOW,
      new Date(),
    )) {
      const { items } = await this.animeRepository.getRankedSubjects(ctx, {
        year,
        month,
        sort: "rank",
      });
      subjects.push(...items);
    }
    return subjects.slice(0, RANKED_SUBJECT_LIMIT);
  }
}
