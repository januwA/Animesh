import type { Context } from "ajanuw-context";
import type { BangumiCache } from "@/domain/bangumi/BangumiCache";
import type { BangumiRankedSubject } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

/** 背景壁纸最多使用的榜单条目数 */
export const RANKED_SUBJECT_LIMIT = 20;
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

export class GetBangumiRankedSubjectsUseCase {
  constructor(
    private readonly bangumiRepository: BangumiRepository,
    private readonly bangumiCache: BangumiCache,
  ) {}

  async execute(ctx: Context): Promise<BangumiRankedSubject[]> {
    const cached = await this.bangumiCache.getRankedSubjects(ctx);
    if (cached) {
      return cached;
    }

    const subjects: BangumiRankedSubject[] = [];
    for (const { year, month } of recentMonthWindows(
      RANKED_SUBJECT_MONTH_WINDOW,
      new Date(),
    )) {
      const page = await this.bangumiRepository.getRankedSubjects(
        ctx,
        year,
        month,
        RANKED_SUBJECT_LIMIT,
      );
      subjects.push(...page);
    }
    await this.bangumiCache.setRankedSubjects(ctx, subjects);
    return subjects;
  }
}
