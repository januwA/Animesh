import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetSubtitleVttUseCase {
  constructor(
    private torrentRepository: TorrentRepository,
    private subtitleTranslationRepository: SubtitleTranslationRepository,
  ) {}

  async execute(dto: {
    infoHash: string;
    fileId: number;
    trackId: number | string;
  }): Promise<string> {
    if (typeof dto.trackId === "string") {
      // AI 翻译字幕：从数据库获取
      const record = await this.subtitleTranslationRepository.getById(
        dto.trackId,
      );
      // v8 ignore next
      if (!record) throw new Error("未找到翻译记录");
      return record.vtt_content;
    }
    // 原始字幕：从 MKV 文件获取
    return this.torrentRepository.getSubtitleVtt(
      dto.infoHash,
      dto.fileId,
      dto.trackId,
    );
  }
}
