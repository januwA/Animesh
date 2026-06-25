import { describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { GetSettingsUseCase } from "./GetSettingsUseCase";
import { SaveSettingsUseCase } from "./SaveSettingsUseCase";
import { SelectDirectoryUseCase } from "./SelectDirectoryUseCase";

describe("Settings 相关的 UseCase 业务编排", () => {
	const mockRepo = {
		getSettings: vi.fn(),
		setDownloadDir: vi.fn(),
		setProxy: vi.fn(),
		selectDirectory: vi.fn(),
	} as unknown as SettingsRepository;

	it("GetSettingsUseCase 应该正确获取配置选项", async () => {
		const useCase = new GetSettingsUseCase(mockRepo);
		vi.mocked(mockRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock/dir",
			proxy: null,
		});
		const result = await useCase.execute();
		expect(mockRepo.getSettings).toHaveBeenCalled();
		expect(result).toEqual({ download_dir: "/mock/dir", proxy: null });
	});

	it("SaveSettingsUseCase 应该调用 repository 里的 setDownloadDir 和 setProxy 方法", async () => {
		const useCase = new SaveSettingsUseCase(mockRepo);
		vi.mocked(mockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
		vi.mocked(mockRepo.setProxy).mockResolvedValueOnce(undefined);
		await useCase.execute("/mock/dir2", "http://127.0.0.1:1080");
		expect(mockRepo.setDownloadDir).toHaveBeenCalledWith("/mock/dir2");
		expect(mockRepo.setProxy).toHaveBeenCalledWith("http://127.0.0.1:1080");
	});

	it("SelectDirectoryUseCase 应该正确拉起目录选择框", async () => {
		const useCase = new SelectDirectoryUseCase(mockRepo);
		vi.mocked(mockRepo.selectDirectory).mockResolvedValueOnce("/chosen/path");
		const path = await useCase.execute();
		expect(mockRepo.selectDirectory).toHaveBeenCalled();
		expect(path).toBe("/chosen/path");
	});
});
