import { describe, expect, it, vi } from "vitest";
import type { IptvStreamUrlRepository } from "@/domain/iptv/IptvStreamUrlRepository";
import { ResolvePlayableStreamUrlUseCase } from "./ResolvePlayableStreamUrlUseCase";

describe("应用层 ResolvePlayableStreamUrlUseCase", () => {
  it("应委托给仓库解析可播放地址", async () => {
    const repository = {
      resolvePlayableStreamUrl: vi.fn().mockResolvedValue({
        url: "http://127.0.0.1:1/iptv-proxy?url=x",
        kind: "hls",
      }),
    } as unknown as IptvStreamUrlRepository;
    const useCase = new ResolvePlayableStreamUrlUseCase(repository);

    const result = await useCase.execute("http://example.com/live.m3u8");

    expect(repository.resolvePlayableStreamUrl).toHaveBeenCalledWith(
      "http://example.com/live.m3u8",
    );
    expect(result).toEqual({
      url: "http://127.0.0.1:1/iptv-proxy?url=x",
      kind: "hls",
    });
  });
});
