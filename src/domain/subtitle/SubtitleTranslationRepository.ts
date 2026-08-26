import type { SubtitleTranslationRecord } from "./SubtitleTranslationSchemas";

export interface SubtitleTranslationRepository {
  /** 按 UUID 查询记录。命中时返回完整记录（含 vtt_content）。未命中返回 null。 */
  getById(id: string): Promise<SubtitleTranslationRecord | null>;

  /** 列出指定种子+文件下的所有翻译记录（vtt_content 为空字符串）。 */
  listByTorrent(
    infoHash: string,
    fileId: number,
  ): Promise<SubtitleTranslationRecord[]>;

  /** 保存（INSERT）一条翻译记录。每次调用都写入一条新记录，保留历史。 */
  save(record: SubtitleTranslationRecord): Promise<void>;

  /** 删除指定 UUID 的记录。返回是否实际删除了一行。 */
  deleteById(id: string): Promise<boolean>;

  /** 删除指定种子+文件下的所有翻译记录。返回实际删除的行数。 */
  deleteByTorrent(infoHash: string, fileId: number): Promise<number>;

  /** 删除指定种子 info_hash 下所有文件、所有轨道、所有语言、所有 AI 配置的翻译记录。
   *  用于删除整个下载任务时一并清理。返回实际删除的行数。 */
  deleteByInfoHash(infoHash: string): Promise<number>;
}
