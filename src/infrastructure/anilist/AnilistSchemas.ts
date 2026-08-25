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
  averageScore: z.number().nullable().optional(),
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

export const AnilistPageSchema = z.object({
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

function formatUnixToDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pickCoverImage(
  coverImage: z.infer<typeof AnilistCoverImageSchema>,
): string {
  return coverImage.large || coverImage.medium || "";
}

export const AnilistCalendarResponseSchema = AnilistResponseSchema.transform(
  (dto) => {
    const schedules = dto.data.Page.airingSchedules;

    // 按星期分组，同一天内按 mediaId 去重（同番不同集可能在不同天播出）
    const grouped = new Map<
      number,
      { id: number; name: string; image: string; rating: number }[]
    >();
    for (const schedule of schedules) {
      const weekdayId = getLocalWeekday(schedule.airingAt);
      const items = grouped.get(weekdayId) ?? [];
      if (!items.some((item) => item.id === schedule.mediaId)) {
        items.push({
          id: schedule.mediaId,
          name: pickTitle(schedule.media.title),
          image: pickCoverImage(schedule.media.coverImage),
          rating: (schedule.media.averageScore ?? 0) / 10,
        });
      }
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

// ── Media 详情 (getSubject) ─────────────────────────────────────────────────

const AnilistStartDateSchema = z.object({
  year: z.number().nullable(),
  month: z.number().nullable(),
  day: z.number().nullable(),
});

const AnilistMediaDetailSchema = z.object({
  id: z.number(),
  title: AnilistTitleSchema,
  description: z.string().nullable().optional(),
  coverImage: AnilistCoverImageSchema,
  averageScore: z.number().nullable().optional(),
  episodes: z.number().nullable().optional(),
  startDate: AnilistStartDateSchema.nullable().optional(),
  format: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
});

export const AnilistSubjectResponseSchema = z
  .object({
    data: z.object({
      Media: AnilistMediaDetailSchema,
    }),
  })
  .transform((dto) => {
    const m = dto.data.Media;
    const startDate = m.startDate;
    const date =
      startDate?.year && startDate?.month && startDate?.day
        ? `${startDate.year}-${String(startDate.month).padStart(2, "0")}-${String(startDate.day).padStart(2, "0")}`
        : null;

    return {
      id: m.id,
      name: pickTitle(m.title),
      summary: m.description ?? "",
      image: pickCoverImage(m.coverImage),
      rating: (m.averageScore ?? 0) / 10,
      date,
      eps: m.episodes ?? null,
      platform: m.format ?? null,
    };
  });

// ── Airing Schedule → AnimeEpisodesPage (getEpisodes) ─────────────────────

const AnilistAiringScheduleNodeSchema = z.object({
  id: z.number(),
  airingAt: z.number(),
  episode: z.number(),
});

export const AnilistEpisodesResponseSchema = z
  .object({
    data: z.object({
      Media: z.object({
        airingSchedule: z.object({
          nodes: z.array(AnilistAiringScheduleNodeSchema),
        }),
      }),
    }),
  })
  .transform((dto) => {
    const nodes = dto.data.Media.airingSchedule.nodes;
    const items = nodes.map((node) => ({
      id: node.id,
      sort: node.episode,
      name: "",
      duration: null as string | null,
      airdate: formatUnixToDate(node.airingAt),
    }));
    items.sort((a, b) => a.sort - b.sort);
    return { items, total: items.length };
  });

// ── Characters → AnimeCharacter[] (getSubjectCharacters) ──────────────────

const AnilistCharacterNodeSchema = z.object({
  id: z.number(),
  name: z.object({ full: z.string() }),
  image: z.object({ large: z.string().nullable().optional() }).optional(),
});

const AnilistCharacterEdgeSchema = z.object({
  role: z.string().nullable().optional(),
  node: AnilistCharacterNodeSchema,
  voiceActors: z
    .array(
      z.object({
        name: z.object({ full: z.string() }),
      }),
    )
    .optional(),
});

export const AnilistCharactersResponseSchema = z
  .object({
    data: z.object({
      Media: z.object({
        characters: z.object({
          edges: z.array(AnilistCharacterEdgeSchema),
        }),
      }),
    }),
  })
  .transform((dto) => {
    return dto.data.Media.characters.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name.full,
      relation: edge.role ?? "",
      image: edge.node.image?.large ?? "",
      actors: (edge.voiceActors ?? []).map((va) => ({ name: va.name.full })),
    }));
  });

// ── Staff → AnimePerson[] (getSubjectPersons) ────────────────────────────

const AnilistStaffEdgeSchema = z.object({
  role: z.string().nullable().optional(),
  node: z.object({
    id: z.number(),
    name: z.object({ full: z.string() }),
    image: z.object({ large: z.string().nullable().optional() }).optional(),
  }),
});

export const AnilistStaffResponseSchema = z
  .object({
    data: z.object({
      Media: z.object({
        staff: z.object({
          edges: z.array(AnilistStaffEdgeSchema),
        }),
      }),
    }),
  })
  .transform((dto) => {
    return dto.data.Media.staff.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name.full,
      relation: edge.role ?? "",
      eps: "",
      image: edge.node.image?.large ?? "",
    }));
  });

// ── 搜索 → AnimeSubjectSearchResult (searchSubjects) ─────────────────────

const AnilistSearchMediaSchema = z.object({
  id: z.number(),
  title: AnilistTitleSchema,
  coverImage: AnilistCoverImageSchema,
  averageScore: z.number().nullable().optional(),
});

export const AnilistSearchResponseSchema = z
  .object({
    data: z.object({
      Page: z.object({
        pageInfo: z.object({ total: z.number() }),
        media: z.array(AnilistSearchMediaSchema),
      }),
    }),
  })
  .transform((dto) => ({
    items: dto.data.Page.media.map((m) => ({
      id: m.id,
      name: pickTitle(m.title),
      summary: "",
      image: pickCoverImage(m.coverImage),
      rating: (m.averageScore ?? 0) / 10,
      date: null as string | null,
      eps: null as number | null,
      platform: null as string | null,
    })),
    total: dto.data.Page.pageInfo.total,
  }));

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

export const AnilistSubjectStoredSchema = z.object({
  id: z.number(),
  name: z.string(),
  summary: z.string(),
  image: z.string(),
  rating: z.number(),
  date: z.string().nullable().optional(),
  eps: z.number().nullable().optional(),
  platform: z.string().nullable().optional(),
});

export const AnilistEpisodeStoredSchema = z.object({
  id: z.number(),
  sort: z.number(),
  name: z.string(),
  duration: z.string().nullable().optional(),
  airdate: z.string().nullable().optional(),
});

export const AnilistEpisodesStoredSchema = z.object({
  items: z.array(AnilistEpisodeStoredSchema),
  total: z.number(),
});

export const AnilistCharacterStoredSchema = z.object({
  id: z.number(),
  name: z.string(),
  relation: z.string(),
  image: z.string(),
  actors: z.array(z.object({ name: z.string() })),
});

export const AnilistPersonStoredSchema = z.object({
  id: z.number(),
  name: z.string(),
  relation: z.string(),
  eps: z.string(),
  image: z.string(),
});
