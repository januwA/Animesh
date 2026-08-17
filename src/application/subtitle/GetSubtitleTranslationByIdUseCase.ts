import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import type { SubtitleTranslationRecord } from "../../domain/subtitle/SubtitleTranslationSchemas";

export class GetSubtitleTranslationByIdUseCase {
  constructor(
    private subtitleTranslationRepository: SubtitleTranslationRepository,
  ) {}

  async execute(id: string): Promise<SubtitleTranslationRecord | null> {
    return this.subtitleTranslationRepository.getById(id);
  }
}
