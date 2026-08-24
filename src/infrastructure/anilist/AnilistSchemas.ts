import { z } from "zod";

// ── AniList GraphQL 响应 Schema ──────────────────────────────────────────────

const AnilistTitleSchema = z.object({
  romaji: z.string().nullable(),
  english: z.string().nullable(),
  native: z.string().nullable(),
  userPreferred: z.string().nullable(),
});

const AnilistCoverImageSchema = z.object({
  large: z.string().nullable().optional(),
  medium: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});

const AnilistMediaSchema = z.object({
  id: z.number(),
  title: AnilistTitleSchema,
  coverImage: AnilistCoverImageSchema,
});

const AnilistAiringScheduleSchema = z.object({
  id: z.number(),
  airingAt: z.number(),
  episode: z.number(),
  mediaId: z.number(),
  media: AnilistMediaSchema,
});

const AnilistPageInfoSchema = z.object({
  hasNextPage: z.boolean(),
});

const AnilistPageSchema = z.object({
  pageInfo: AnilistPageInfoSchema,
  airingSchedules: z.array(AnilistAiringScheduleSchema),
});

export const AnilistResponseSchema = z.object({
  data: z.object({
    Page: AnilistPageSchema,
  }),
});

// ── 领域转换：flat schedules → AnimeCalendarDay[] ───────────────────────────

function getLocalWeekday(unixSeconds: number): number {
  const date = new Date(unixSeconds * 1000);
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function pickTitle(title: z.infer<typeof AnilistTitleSchema>): string {
  return (
    title.userPreferred || title.english || title.romaji || title.native || ""
  );
}

function pickCoverImage(
  coverImage: z.infer<typeof AnilistCoverImageSchema>,
): string {
  return coverImage.large || coverImage.medium || "";
}

export const AnilistCalendarResponseSchema = AnilistResponseSchema.transform(
  (dto) => {
    const schedules = dto.data.Page.airingSchedules;

    // 按星期分组（同番不同集可能在不同天播出，不去重）
    const grouped = new Map<
      number,
      { id: number; name: string; image: string; rating: number }[]
    >();
    for (const schedule of schedules) {
      const weekdayId = getLocalWeekday(schedule.airingAt);
      const items = grouped.get(weekdayId) ?? [];
      items.push({
        id: schedule.mediaId,
        name: pickTitle(schedule.media.title),
        image: pickCoverImage(schedule.media.coverImage),
        rating: 0,
      });
      grouped.set(weekdayId, items);
    }

    // 生成完整的 7 天数组（确保星期顺序正确）
    const result: {
      weekday: { id: number };
      items: { id: number; name: string; image: string; rating: number }[];
    }[] = [];
    for (let dayId = 1; dayId <= 7; dayId++) {
      result.push({
        weekday: { id: dayId },
        items: grouped.get(dayId) ?? [],
      });
    }
    return result;
  },
);

// ── 存储 Schema（用于缓存回读校验，与领域形状一致，无需 transform）────────

export const AnilistCalendarItemStoredSchema = z.object({
  id: z.number(),
  name: z.string(),
  image: z.string(),
  rating: z.number(),
});

export const AnilistCalendarDayStoredSchema = z.object({
  weekday: z.object({ id: z.number() }),
  items: z.array(AnilistCalendarItemStoredSchema),
});

export const AnilistCalendarStoredSchema = z.array(
  AnilistCalendarDayStoredSchema,
);
