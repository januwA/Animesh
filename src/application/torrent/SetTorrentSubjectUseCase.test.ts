import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { SetTorrentSubjectUseCase } from "./SetTorrentSubjectUseCase";

describe("SetTorrentSubjectUseCase 关联条目", () => {
  const mockRepo = {
    setTorrentSubject: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 setTorrentSubject 方法", async () => {
    const useCase = new SetTorrentSubjectUseCase(mockRepo);
    vi.mocked(mockRepo.setTorrentSubject).mockResolvedValueOnce(undefined);
    await useCase.execute({
      infoHash: NonEmptyStringSchema.parse("123"),
      subjectId: 42,
      subjectName: NonEmptyStringSchema.parse("测试条目"),
    });
    expect(mockRepo.setTorrentSubject).toHaveBeenCalledWith(
      "123",
      42,
      "测试条目",
    );
  });
});
