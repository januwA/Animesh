import type { Context } from "ajanuw-context";
import type {
  BangumiSubjectSearchParams,
  BangumiSubjectSearchResult,
} from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class SearchBangumiSubjectsUseCase {
  constructor(private readonly bangumiRepository: BangumiRepository) {}

  async execute(
    ctx: Context,
    params: BangumiSubjectSearchParams,
  ): Promise<BangumiSubjectSearchResult> {
    return this.bangumiRepository.searchSubjects(ctx, params);
  }
}
