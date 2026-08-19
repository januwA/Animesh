import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { SetThemeUseCase } from "./SetThemeUseCase";

describe("SetThemeUseCase 设置主题", () => {
  const rawMockRepo = {
    setTheme: vi.fn(),
  };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该调用 repository 里的 setTheme 方法", async () => {
    const useCase = new SetThemeUseCase(mockRepo);
    vi.mocked(rawMockRepo.setTheme).mockResolvedValueOnce(undefined);
    await useCase.execute("dark");
    expect(rawMockRepo.setTheme).toHaveBeenCalledWith("dark");
  });
});
