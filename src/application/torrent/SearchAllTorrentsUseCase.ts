import type { Context } from "ajanuw-context";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { TorrentSearchEngine } from "@/domain/torrent/TorrentEngines";
import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import type { SearchTorrentsUseCase } from "./SearchTorrentsUseCase";

export interface SearchAllTorrentsDto {
  keyword: NonEmptyString;
  engines: TorrentSearchEngine[];
}

/**
 * 发布时间的 10 分钟去重窗口（毫秒）。
 * 作者制作好种子会同一时段向多个平台发布同一资源，故同 title 且发布在窗口内的视为重复。
 */
const PUB_DATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * 对标题做轻量归一化，便于跨引擎（dmhy/nyaa 等）识别同一资源：
 * trim → 折叠连续空白 → 小写。
 */
function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/** 将 pub_date 解析为毫秒时间戳；无法解析时返回 null。 */
function toTime(pubDate: string): number | null {
  const time = new Date(pubDate).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * 多引擎聚合搜索用例。
 *
 * 并行调用各引擎搜索，按归一化后的 title 去重（保留首个出现的条目）；
 * 仅当同一 title 的 pub_date 与已保留条目相差在 10 分钟窗口内才视为重复。
 * 全部引擎失败时抛首个错误，否则返回合并结果。
 */
export class SearchAllTorrentsUseCase {
  constructor(private readonly searchTorrentsUseCase: SearchTorrentsUseCase) {}

  async execute(
    ctx: Context,
    dto: SearchAllTorrentsDto,
  ): Promise<SearchResultItem[]> {
    const results = await Promise.allSettled(
      dto.engines.map((engine) =>
        this.searchTorrentsUseCase.execute(ctx, {
          keyword: dto.keyword,
          engine,
        }),
      ),
    );

    const merged: SearchResultItem[] = [];
    const pubDatesByTitle = new Map<string, number[]>();

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const item of result.value) {
        const key = normalizeTitle(item.title);
        const time = toTime(item.pub_date);
        const acceptedTimes = pubDatesByTitle.get(key);

        const isDuplicate =
          time !== null &&
          acceptedTimes?.some(
            (accepted) => Math.abs(accepted - time) <= PUB_DATE_WINDOW_MS,
          ) === true;
        if (isDuplicate) continue;

        if (acceptedTimes === undefined) {
          pubDatesByTitle.set(key, time !== null ? [time] : []);
        } else if (time !== null) {
          acceptedTimes.push(time);
        }

        merged.push(item);
      }
    }

    const allFailed = results.every((r) => r.status === "rejected");
    if (allFailed && results.length > 0) {
      const firstError = results[0] as PromiseRejectedResult;
      throw firstError.reason;
    }

    return merged;
  }
}
