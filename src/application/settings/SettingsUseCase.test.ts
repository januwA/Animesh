import { describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { GetSettingsUseCase } from "./GetSettingsUseCase";
import { SaveSettingsUseCase } from "./SaveSettingsUseCase";
import { SelectDirectoryUseCase } from "./SelectDirectoryUseCase";

describe("Settings 相关的 UseCase 业务编排", () => {
	const rawMockRepo = {
		getSettings: vi.fn(),
		setDownloadDir: vi.fn(),
		setProxy: vi.fn(),
		setTrackers: vi.fn(),
		selectDirectory: vi.fn(),
	};
	const mockRepo = rawMockRepo as unknown as SettingsRepository;

	it("GetSettingsUseCase 应该正确获取配置选项", async () => {
		const useCase = new GetSettingsUseCase(mockRepo);
		vi.mocked(rawMockRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock/dir",
			proxy: null,
			trackers: ["udp://tracker1"],
		});
		const result = await useCase.execute();
		expect(rawMockRepo.getSettings).toHaveBeenCalled();
		expect(result).toEqual({
			download_dir: "/mock/dir",
			proxy: null,
			trackers: ["udp://tracker1"],
		});
	});

	it("SaveSettingsUseCase 应该调用 repository 里的 setDownloadDir、setProxy 和 setTrackers 方法", async () => {
		const useCase = new SaveSettingsUseCase(mockRepo);
		vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setTrackers).mockResolvedValueOnce(undefined);
		await useCase.execute({
			downloadDir: "/mock/dir2",
			proxy: "http://127.0.0.1:1080",
			trackers: ["udp://tracker1"],
		});
		expect(rawMockRepo.setDownloadDir).toHaveBeenCalledWith("/mock/dir2");
		expect(rawMockRepo.setProxy).toHaveBeenCalledWith("http://127.0.0.1:1080");
		expect(rawMockRepo.setTrackers).toHaveBeenCalledWith(["udp://tracker1"]);
	});

	it("SelectDirectoryUseCase 应该正确拉起目录选择框", async () => {
		const useCase = new SelectDirectoryUseCase(mockRepo);
		vi.mocked(rawMockRepo.selectDirectory).mockResolvedValueOnce(
			"/chosen/path",
		);
		const path = await useCase.execute();
		expect(rawMockRepo.selectDirectory).toHaveBeenCalled();
		expect(path).toBe("/chosen/path");
	});
});
