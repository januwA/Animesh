import { Background, WithValue } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { SearchTorrentsUseCase } from "./SearchTorrentsUseCase";

describe("SearchTorrentsUseCase 搜索资源", () => {
  const mockRepo = {
    search: vi.fn(),
  } as unknown as TorrentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确调用 repository 的 search 方法", async () => {
    const useCase = new SearchTorrentsUseCase(mockRepo);
    vi.mocked(mockRepo.search).mockResolvedValueOnce([
      { name: "test anime", magnet: "magnet:?xt=urn:btih:123" } as any,
    ]);
    const ctx = WithValue(Background, "traceId", "test-trace");
    const results = await useCase.execute(ctx, {
      keyword: NonEmptyStringSchema.parse("test"),
      engine: "mikan",
    });
    expect(mockRepo.search).toHaveBeenCalledWith(ctx, "test", "mikan");
    expect(results).toEqual([
      { name: "test anime", magnet: "magnet:?xt=urn:btih:123" },
    ]);
  });
});
