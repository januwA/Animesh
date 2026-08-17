import { z } from "zod";

/**
 * 完整的字幕翻译记录。
 *
 * 每次翻译都会生成一条带唯一 `id`（UUID）的新记录，保留翻译历史。
 * list_by_torrent 返回时 vtt_content 为空字符串（避免传输过大），
 * getById 返回时包含完整 vtt_content。
 */
export const SubtitleTranslationRecordSchema = z.object({
  id: z.string(),
  info_hash: z.string(),
  file_id: z.number(),
  original_track_id: z.number(),
  source_lang: z.string(),
  target_lang: z.string(),
  vtt_content: z.string(),
  created_at: z.number(),
  last_accessed_at: z.number(),
});

export type SubtitleTranslationRecord = z.infer<
  typeof SubtitleTranslationRecordSchema
>;
