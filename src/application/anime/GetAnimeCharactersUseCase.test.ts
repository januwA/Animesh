import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";
import { GetAnimeCharactersUseCase } from "./GetAnimeCharactersUseCase";

describe("GetAnimeCharactersUseCase 获取条目角色", () => {
  const mockRepo = {
    getSubjectCharacters: vi.fn(),
  } as unknown as AnimeRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该请求 Repository 并返回数据", async () => {
    const freshData = [
      {
        id: 1,
        name: "char1",
        relation: "主角",
        type: 1,
        summary: "desc",
        images: { small: "", grid: "", large: "", medium: "" },
        actors: [],
      },
    ];
    vi.mocked(mockRepo.getSubjectCharacters).mockResolvedValueOnce(
      freshData as any,
    );

    const useCase = new GetAnimeCharactersUseCase(mockRepo);
    const result = await useCase.execute(
      Background,
      NonEmptyStringSchema.parse("1"),
    );

    expect(mockRepo.getSubjectCharacters).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(result).toEqual(freshData);
  });
});
