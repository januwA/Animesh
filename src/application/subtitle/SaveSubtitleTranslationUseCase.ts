import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import type { SubtitleTranslationRecord } from "../../domain/subtitle/SubtitleTranslationSchemas";

export class SaveSubtitleTranslationUseCase {
  constructor(
    private subtitleTranslationRepository: SubtitleTranslationRepository,
  ) {}

  async execute(record: SubtitleTranslationRecord): Promise<void> {
    await this.subtitleTranslationRepository.save(record);
  }
}
