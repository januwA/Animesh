import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";
import { GetAnimePersonsUseCase } from "./GetAnimePersonsUseCase";

describe("GetAnimePersonsUseCase 获取条目制作人员", () => {
  const mockRepo = {
    getSubjectPersons: vi.fn(),
  } as unknown as AnimeRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该请求 Repository 并返回数据", async () => {
    const freshData = [
      {
        id: 1,
        name: "person1",
        relation: "导演",
        career: ["导演"],
        type: 1,
        eps: "1-12",
        images: { small: "", grid: "", large: "", medium: "" },
      },
    ];
    vi.mocked(mockRepo.getSubjectPersons).mockResolvedValueOnce(
      freshData as any,
    );

    const useCase = new GetAnimePersonsUseCase(mockRepo);
    const result = await useCase.execute(
      Background,
      NonEmptyStringSchema.parse("1"),
    );

    expect(mockRepo.getSubjectPersons).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(result).toEqual(freshData);
  });
});
