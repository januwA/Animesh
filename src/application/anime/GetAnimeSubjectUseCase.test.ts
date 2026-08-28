import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";
import { GetAnimeSubjectUseCase } from "./GetAnimeSubjectUseCase";

describe("GetAnimeSubjectUseCase 获取条目信息", () => {
  const mockRepo = {
    getSubject: vi.fn(),
  } as unknown as AnimeRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该请求 Repository 并返回数据", async () => {
    const freshData: AnimeSubject = {
      id: 1,
      name: "fresh",
      summary: "新鲜",
      image: "",
      rating: 0,
    };
    vi.mocked(mockRepo.getSubject).mockResolvedValueOnce(freshData as any);

    const useCase = new GetAnimeSubjectUseCase(mockRepo);
    const result = await useCase.execute(
      Background,
      NonEmptyStringSchema.parse("1"),
    );

    expect(mockRepo.getSubject).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(result).toEqual(freshData);
  });
});
