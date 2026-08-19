import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { ClearTorrentSubjectUseCase } from "./ClearTorrentSubjectUseCase";

describe("ClearTorrentSubjectUseCase 清除条目关联", () => {
  const mockRepo = {
    clearTorrentSubject: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 clearTorrentSubject 方法", async () => {
    const useCase = new ClearTorrentSubjectUseCase(mockRepo);
    vi.mocked(mockRepo.clearTorrentSubject).mockResolvedValueOnce(undefined);
    await useCase.execute(NonEmptyStringSchema.parse("123"));
    expect(mockRepo.clearTorrentSubject).toHaveBeenCalledWith("123");
  });
});
