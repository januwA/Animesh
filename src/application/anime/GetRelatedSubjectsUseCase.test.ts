import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AnimeRepository } from "../../domain/anime/AnimeRepository";
import { GetRelatedSubjectsUseCase } from "./GetRelatedSubjectsUseCase";

describe("GetRelatedSubjectsUseCase 获取关联条目", () => {
  const mockRepo = {
    getRelatedSubjects: vi.fn(),
  } as unknown as AnimeRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该请求 Repository 并返回数据", async () => {
    const freshData = [
      {
        id: 2,
        name: "续作条目",
        image: "http://example.com/cover.jpg",
        relation: "续集",
      },
    ];
    vi.mocked(mockRepo.getRelatedSubjects).mockResolvedValueOnce(freshData);

    const useCase = new GetRelatedSubjectsUseCase(mockRepo);
    const result = await useCase.execute(
      Background,
      NonEmptyStringSchema.parse("1"),
    );

    expect(mockRepo.getRelatedSubjects).toHaveBeenCalledWith(
      Background,
      NonEmptyStringSchema.parse("1"),
    );
    expect(result).toEqual(freshData);
  });

  it("当 Repository 返回空数组时，应该返回空数组", async () => {
    vi.mocked(mockRepo.getRelatedSubjects).mockResolvedValueOnce([]);

    const useCase = new GetRelatedSubjectsUseCase(mockRepo);
    const result = await useCase.execute(
      Background,
      NonEmptyStringSchema.parse("999"),
    );

    expect(result).toEqual([]);
  });
});
