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

  it("应该将合法主题直接传给 repository", async () => {
    const useCase = new SetThemeUseCase(mockRepo);
    vi.mocked(rawMockRepo.setTheme).mockResolvedValueOnce(undefined);
    await useCase.execute("dark");
    expect(rawMockRepo.setTheme).toHaveBeenCalledWith("dark");

    vi.mocked(rawMockRepo.setTheme).mockResolvedValueOnce(undefined);
    await useCase.execute("light");
    expect(rawMockRepo.setTheme).toHaveBeenCalledWith("light");
  });

  it("主题为空或非法时应该归一化为 null 再传给 repository", async () => {
    const useCase = new SetThemeUseCase(mockRepo);
    vi.mocked(rawMockRepo.setTheme).mockResolvedValueOnce(undefined);
    await useCase.execute(undefined);
    expect(rawMockRepo.setTheme).toHaveBeenCalledWith(null);

    vi.mocked(rawMockRepo.setTheme).mockResolvedValueOnce(undefined);
    await useCase.execute("blue");
    expect(rawMockRepo.setTheme).toHaveBeenCalledWith(null);
  });
});
