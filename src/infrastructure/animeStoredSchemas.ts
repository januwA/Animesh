import { z } from "zod";

// ── 共享存储形状 Schema（Bangumi / Anilist 缓存回读校验通用）─────────────────
// 响应 Schema 经 transform 后得到领域形状，缓存中保存的正是该领域形状；
// 因此缓存回读必须用「存储形状 Schema」校验，而不是再次套用带 transform 的响应 Schema。

const CalendarItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  image: z.string(),
  rating: z.number(),
});

const CalendarDaySchema = z.object({
  weekday: z.object({ id: z.number() }),
  items: z.array(CalendarItemSchema),
});

export const AnimeCalendarStoredSchema = z.array(CalendarDaySchema);

export const AnimeSubjectStoredSchema = z.object({
  id: z.number(),
  name: z.string(),
  summary: z.string(),
  image: z.string(),
  rating: z.number(),
  date: z.string().nullable().optional(),
  eps: z.number().nullable().optional(),
  platform: z.string().nullable().optional(),
});

const EpisodeStoredSchema = z.object({
  id: z.number(),
  sort: z.number(),
  name: z.string(),
  duration: z.string().optional().nullable(),
  airdate: z.string().optional().nullable(),
});

export const AnimeEpisodesPageStoredSchema = z.object({
  items: z.array(EpisodeStoredSchema),
  total: z.number(),
});

export const AnimePersonStoredSchema = z.object({
  id: z.number(),
  name: z.string(),
  relation: z.string(),
  eps: z.string(),
  image: z.string(),
});

export const AnimeCharacterStoredSchema = z.object({
  id: z.number(),
  name: z.string(),
  relation: z.string(),
  image: z.string(),
  actors: z.array(z.object({ name: z.string() })),
});

export const AnimePersonsStoredSchema = z.array(AnimePersonStoredSchema);
export const AnimeCharactersStoredSchema = z.array(AnimeCharacterStoredSchema);
export const AnimeRankedSubjectsStoredSchema = z.array(
  AnimeSubjectStoredSchema,
);
export const AnimeNextSeasonStoredSchema = z.array(AnimeSubjectStoredSchema);
