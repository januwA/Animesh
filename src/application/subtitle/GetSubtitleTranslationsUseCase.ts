import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import type { SubtitleTranslationRecord } from "../../domain/subtitle/SubtitleTranslationSchemas";

export class GetSubtitleTranslationsUseCase {
  constructor(
    private subtitleTranslationRepository: SubtitleTranslationRepository,
  ) {}

  /** 返回指定种子+文件下的所有翻译记录（含 vtt_content），按创建时间升序。 */
  async execute(
    infoHash: string,
    fileId: number,
  ): Promise<SubtitleTranslationRecord[]> {
    const list = await this.subtitleTranslationRepository.listByTorrent(
      infoHash,
      fileId,
    );
    if (list.length === 0) return [];

    const records = await Promise.all(
      list.map((item) => this.subtitleTranslationRepository.getById(item.id)),
    );
    return records
      .filter((r): r is SubtitleTranslationRecord => r !== null)
      .sort((a, b) => a.created_at - b.created_at);
  }
}
