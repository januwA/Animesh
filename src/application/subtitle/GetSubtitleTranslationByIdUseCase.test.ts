import { describe, expect, it, vi } from "vitest";
import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import type { SubtitleTranslationRecord } from "../../domain/subtitle/SubtitleTranslationSchemas";
import { GetSubtitleTranslationByIdUseCase } from "./GetSubtitleTranslationByIdUseCase";

describe("GetSubtitleTranslationByIdUseCase", () => {
  it("应该调用仓储的 getById 方法并返回字幕翻译记录", async () => {
    const record: SubtitleTranslationRecord = {
      id: "sub-123",
      info_hash: "hash-123",
      file_id: 1,
      original_track_id: 0,
      source_lang: "en",
      target_lang: "zh",
      vtt_content: "WEBVTT",
      created_at: 1000,
      last_accessed_at: 1000,
    };

    const mockRepo: SubtitleTranslationRepository = {
      getById: vi.fn().mockResolvedValue(record),
      listByTorrent: vi.fn(),
      save: vi.fn(),
      deleteById: vi.fn(),
      deleteByTorrent: vi.fn(),
      deleteByInfoHash: vi.fn(),
    };

    const useCase = new GetSubtitleTranslationByIdUseCase(mockRepo);
    const result = await useCase.execute("sub-123");

    expect(mockRepo.getById).toHaveBeenCalledWith("sub-123");
    expect(result).toEqual(record);
  });
});
