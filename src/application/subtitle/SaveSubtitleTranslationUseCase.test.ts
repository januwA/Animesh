import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import type { SubtitleTranslationRecord } from "../../domain/subtitle/SubtitleTranslationSchemas";
import { SaveSubtitleTranslationUseCase } from "./SaveSubtitleTranslationUseCase";

describe("SaveSubtitleTranslationUseCase", () => {
  it("应该调用仓储的 save 方法保存字幕翻译记录", async () => {
    const mockRepo: SubtitleTranslationRepository = {
      getById: vi.fn(),
      listByTorrent: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      deleteById: vi.fn(),
      deleteByTorrent: vi.fn(),
      deleteByInfoHash: vi.fn(),
    };

    const record: SubtitleTranslationRecord = {
      id: NonEmptyStringSchema.parse("sub-123"),
      info_hash: NonEmptyStringSchema.parse("hash-123"),
      file_id: 1,
      original_track_id: 0,
      source_lang: NonEmptyStringSchema.parse("en"),
      target_lang: NonEmptyStringSchema.parse("zh"),
      vtt_content: "WEBVTT",
      created_at: 1000,
      last_accessed_at: 1000,
    };

    const useCase = new SaveSubtitleTranslationUseCase(mockRepo);
    await useCase.execute(record);

    expect(mockRepo.save).toHaveBeenCalledWith(record);
  });
});
