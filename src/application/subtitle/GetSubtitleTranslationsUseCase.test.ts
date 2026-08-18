import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import type { SubtitleTranslationRecord } from "../../domain/subtitle/SubtitleTranslationSchemas";
import { GetSubtitleTranslationsUseCase } from "./GetSubtitleTranslationsUseCase";

describe("GetSubtitleTranslationsUseCase", () => {
  it("当 listByTorrent 返回空数组时应该返回空数组", async () => {
    const mockRepo: SubtitleTranslationRepository = {
      getById: vi.fn(),
      listByTorrent: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      deleteById: vi.fn(),
      deleteByTorrent: vi.fn(),
      deleteByInfoHash: vi.fn(),
    };

    const useCase = new GetSubtitleTranslationsUseCase(mockRepo);
    const result = await useCase.execute("hash-123", 1);

    expect(result).toEqual([]);
  });

  it("当 listByTorrent 返回记录列表时应该获取完整内容并按创建时间升序排序", async () => {
    const rec1: SubtitleTranslationRecord = {
      id: NonEmptyStringSchema.parse("id-1"),
      info_hash: NonEmptyStringSchema.parse("hash-123"),
      file_id: 1,
      original_track_id: 0,
      source_lang: NonEmptyStringSchema.parse("en"),
      target_lang: NonEmptyStringSchema.parse("zh"),
      vtt_content: "VTT 1",
      created_at: 2000,
      last_accessed_at: 2000,
    };
    const rec2: SubtitleTranslationRecord = {
      id: NonEmptyStringSchema.parse("id-2"),
      info_hash: NonEmptyStringSchema.parse("hash-123"),
      file_id: 1,
      original_track_id: 0,
      source_lang: NonEmptyStringSchema.parse("en"),
      target_lang: NonEmptyStringSchema.parse("zh"),
      vtt_content: "VTT 2",
      created_at: 1000,
      last_accessed_at: 1000,
    };

    const mockRepo: SubtitleTranslationRepository = {
      getById: vi.fn().mockImplementation((id: string) => {
        if (id === "id-1") return Promise.resolve(rec1);
        if (id === "id-2") return Promise.resolve(rec2);
        return Promise.resolve(null);
      }),
      listByTorrent: vi
        .fn()
        .mockResolvedValue([{ id: "id-1" }, { id: "id-2" }, { id: "id-3" }]),
      save: vi.fn(),
      deleteById: vi.fn(),
      deleteByTorrent: vi.fn(),
      deleteByInfoHash: vi.fn(),
    };

    const useCase = new GetSubtitleTranslationsUseCase(mockRepo);
    const result = await useCase.execute("hash-123", 1);

    expect(result).toEqual([rec2, rec1]);
  });
});
