import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import { GetCollectionsUseCase } from "./GetCollectionsUseCase";

describe("GetCollectionsUseCase 获取所有收藏", () => {
  const mockRepo = {
    getAll: vi.fn(),
  } as unknown as CollectionRepository;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("应该调用 repo.getAll() 并返回结果", async () => {
    const fakeData = [{ subjectId: 1 }] as any;
    vi.mocked(mockRepo.getAll).mockResolvedValue(fakeData);

    const useCase = new GetCollectionsUseCase(mockRepo);
    const result = await useCase.execute();

    expect(mockRepo.getAll).toHaveBeenCalledOnce();
    expect(result).toBe(fakeData);
  });
});
