import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { SelectDirectoryUseCase } from "./SelectDirectoryUseCase";

describe("SelectDirectoryUseCase 选择目录", () => {
  const rawMockRepo = {
    selectDirectory: vi.fn(),
  };
  const mockRepo = rawMockRepo as unknown as SettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确拉起目录选择框", async () => {
    const useCase = new SelectDirectoryUseCase(mockRepo);
    vi.mocked(rawMockRepo.selectDirectory).mockResolvedValueOnce(
      "/chosen/path",
    );
    const path = await useCase.execute();
    expect(rawMockRepo.selectDirectory).toHaveBeenCalled();
    expect(path).toBe("/chosen/path");
  });
});
