import type { Context } from "ajanuw-context";
import type { BangumiCache } from "@/domain/bangumi/BangumiCache";
import type { BangumiEpisodesPage } from "@/domain/bangumi/BangumiSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export interface GetEpisodesPageCommand {
  subjectId: string;
  offset: number;
  limit: number;
}

export class GetBangumiEpisodesUseCase {
  constructor(
    private readonly bangumiRepository: BangumiRepository,
    private readonly bangumiCache: BangumiCache,
  ) {}

  async execute(
    ctx: Context,
    command: GetEpisodesPageCommand,
  ): Promise<BangumiEpisodesPage> {
    const { subjectId, offset, limit } = command;
    const cached = await this.bangumiCache.getEpisodes(
      ctx,
      NonEmptyStringSchema.parse(subjectId),
      offset,
      limit,
    );
    if (cached) {
      return cached;
    }
    const page = await this.bangumiRepository.getEpisodes(
      ctx,
      NonEmptyStringSchema.parse(subjectId),
      offset,
      limit,
    );
    await this.bangumiCache.setEpisodes(
      ctx,
      NonEmptyStringSchema.parse(subjectId),
      offset,
      limit,
      page,
    );
    return page;
  }
}
