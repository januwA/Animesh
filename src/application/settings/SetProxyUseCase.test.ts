import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { SetProxyUseCase } from "./SetProxyUseCase";

describe("SetProxyUseCase 设置代理", () => {
  const rawMockRepo = { setProxy: vi.fn() };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该调用 repository 的 setProxy", async () => {
    const useCase = new SetProxyUseCase(mockRepo);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    await useCase.execute("socks5://127.0.0.1:1080");
    expect(rawMockRepo.setProxy).toHaveBeenCalledWith(
      "socks5://127.0.0.1:1080",
    );
  });

  it("传入 null 时应该调用 setProxy(null)", async () => {
    const useCase = new SetProxyUseCase(mockRepo);
    vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
    await useCase.execute(null);
    expect(rawMockRepo.setProxy).toHaveBeenCalledWith(null);
  });
});
