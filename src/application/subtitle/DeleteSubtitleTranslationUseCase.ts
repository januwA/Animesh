import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";

export class DeleteSubtitleTranslationUseCase {
  constructor(
    private subtitleTranslationRepository: SubtitleTranslationRepository,
  ) {}

  async execute(id: string): Promise<boolean> {
    return this.subtitleTranslationRepository.deleteById(id);
  }
}
