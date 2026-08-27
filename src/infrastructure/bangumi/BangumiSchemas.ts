import { z } from "zod";

const BangumiWeekdaySchema = z.object({
  en: z.string(),
  cn: z.string(),
  ja: z.string(),
  id: z.number(),
});

const BangumiImagesSchema = z.object({
  large: z.string().optional(),
  common: z.string().optional(),
  medium: z.string().optional(),
  small: z.string().optional(),
  grid: z.string().optional(),
});

function transformImagesObj(
  imagesObject: z.infer<typeof BangumiImagesSchema>,
): string {
  return (
    imagesObject.common ||
    imagesObject.medium ||
    imagesObject.large ||
    imagesObject.small ||
    ""
  );
}

const BangumiSubjectRatingSchema = z.object({
  total: z.number(),
  score: z.number(),
});

const BangumiCalendarItemSchema = z
  .object({
    id: z.number(),
    url: z.string(),
    name: z.string(),
    name_cn: z.string(),
    air_date: z.string(),
    air_weekday: z.number(),
    rating: BangumiSubjectRatingSchema.nullable().optional(),
    rank: z.number().nullable().optional(),
    images: BangumiImagesSchema,
  })
  .transform((dto) => ({
    id: dto.id,
    name: dto.name_cn || dto.name,
    image: transformImagesObj(dto.images),
    rating: dto.rating?.score || 0,
  }));

const BangumiCalendarDaySchema = z
  .object({
    weekday: BangumiWeekdaySchema,
    items: z.array(BangumiCalendarItemSchema),
  })
  .transform((dto) => ({
    weekday: { id: dto.weekday.id },
    items: dto.items,
  }));

export const BangumiCalendarResponseSchema = z.array(BangumiCalendarDaySchema);

export const BangumiSubjectSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    name_cn: z.string(),
    summary: z.string().nullable().optional(),
    images: BangumiImagesSchema,
    rating: z
      .object({
        score: z.number().nullable().optional(),
        rank: z.number().nullable().optional(),
        total: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    date: z.string().nullable().optional(),
    eps: z.number().nullable().optional(),
    platform: z.string().nullable().optional(),
  })
  .transform((dto) => {
    const { images, name_cn, ...other } = dto;
    return {
      ...other,
      name: dto.name_cn || dto.name,
      summary: dto.summary || "",
      image: transformImagesObj(dto.images),
      rating: dto.rating?.score || 0,
    };
  });

const BangumiEpisodeSchema = z
  .object({
    id: z.number(),
    type: z.number(),
    sort: z.number(),
    name: z.string(),
    name_cn: z.string(),
    duration: z.string().optional().nullable(),
    airdate: z.string().optional().nullable(),
    desc: z.string().optional().nullable(),
  })
  .transform((dto) => {
    const { name_cn, type, desc, ...other } = dto;
    return {
      ...other,
      name: dto.name_cn || dto.name,
    };
  });

export const BangumiEpisodesResponseSchema = z.object({
  data: z.array(BangumiEpisodeSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

/**
 * 条目搜索响应 Schema。
 * Paged_Subject 响应中 data 为完整 Subject，经 transform 后仅暴露表现层所需字段。
 * API: https://api.bgm.tv/v0/search/subjects
 */
export const BangumiSubjectSearchResponseSchema = z
  .object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    data: z.array(BangumiSubjectSchema),
  })
  .transform((dto) => ({
    items: dto.data,
    total: dto.total,
  }));

/** GET /v0/subjects 响应 Schema（Paged_Subject 形状），transform 后仅暴露 items。 */
export const BangumiRankedSubjectsResponseSchema = z
  .object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    data: z.array(BangumiSubjectSchema),
  })
  .transform((dto) => ({
    items: dto.data,
    total: dto.total,
  }));

/**
 * Person/Staff schema — represents a staff member or organization
 * involved in the subject production.
 * API: https://api.bgm.tv/v0/subjects/{subject_id}/persons
 */
export const BangumiPersonSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    relation: z.string(),
    career: z.array(z.string()),
    type: z.number(),
    eps: z.string(),
    images: BangumiImagesSchema,
  })
  .transform((dto) => {
    const { images, career, type, ...other } = dto;
    return {
      ...other,
      image: transformImagesObj(images),
    };
  });

/**
 * Actor/Voice actor schema — nested inside character data.
 */
export const BangumiActorSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    images: BangumiImagesSchema,
    short_summary: z.string(),
    career: z.array(z.string()),
    type: z.number(),
    locked: z.boolean(),
  })
  .transform((dto) => ({
    name: dto.name,
  }));

/**
 * Character schema — represents a character appearing in the subject.
 * API: https://api.bgm.tv/v0/subjects/{subject_id}/characters
 */
export const BangumiCharacterSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    images: BangumiImagesSchema,
    summary: z.string(),
    relation: z.string(),
    type: z.number(),
    actors: z.array(BangumiActorSchema),
  })
  .transform((dto) => {
    const { images, summary, type, ...other } = dto;
    return {
      ...other,
      image: transformImagesObj(images),
      actors: dto.actors,
    };
  });

export const BangumiPersonsResponseSchema = z.array(BangumiPersonSchema);
export const BangumiCharactersResponseSchema = z.array(BangumiCharacterSchema);

// ── 存储形状 Schema（用于缓存回读校验）────────────────────────────────────
// 响应 Schema 经 transform 后得到领域形状，缓存中保存的正是该领域形状；
// 因此缓存回读必须用「存储形状 Schema」校验，而不是再次套用带 transform 的响应 Schema，
// 否则已 transform 的字段（如 name_cn/images/rating）必然校验失败并导致缓存失效。
export const BangumiCalendarItemStoredSchema = z.object({
  id: z.number(),
  name: z.string(),
  image: z.string(),
  rating: z.number(),
});

export const BangumiCalendarDayStoredSchema = z.object({
  weekday: z.object({ id: z.number() }),
  items: z.array(BangumiCalendarItemStoredSchema),
});

export const BangumiCalendarStoredSchema = z.array(
  BangumiCalendarDayStoredSchema,
);

export const BangumiSubjectStoredSchema = z.object({
  id: z.number(),
  name: z.string(),
  summary: z.string(),
  image: z.string(),
  rating: z.number(),
  date: z.string().nullable().optional(),
  eps: z.number().nullable().optional(),
  platform: z.string().nullable().optional(),
});

export const BangumiEpisodeStoredSchema = z.object({
  id: z.number(),
  sort: z.number(),
  name: z.string(),
  duration: z.string().optional().nullable(),
  airdate: z.string().optional().nullable(),
});

export const BangumiEpisodesPageStoredSchema = z.object({
  items: z.array(BangumiEpisodeStoredSchema),
  total: z.number(),
});

export const BangumiPersonStoredSchema = z.object({
  id: z.number(),
  name: z.string(),
  relation: z.string(),
  eps: z.string(),
  image: z.string(),
});

export const BangumiCharacterStoredSchema = z.object({
  id: z.number(),
  name: z.string(),
  relation: z.string(),
  image: z.string(),
  actors: z.array(z.object({ name: z.string() })),
});

export const BangumiPersonsStoredSchema = z.array(BangumiPersonStoredSchema);
export const BangumiCharactersStoredSchema = z.array(
  BangumiCharacterStoredSchema,
);

export const BangumiRankedSubjectsStoredSchema = z.array(
  BangumiSubjectStoredSchema,
);

export const BangumiNextSeasonStoredSchema = z.array(
  BangumiSubjectStoredSchema,
);
