import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import { GetSettingsUseCase } from "./GetSettingsUseCase";
import { SaveSettingsUseCase } from "./SaveSettingsUseCase";
import { SelectDirectoryUseCase } from "./SelectDirectoryUseCase";
import { SyncTrackersUseCase } from "./SyncTrackersUseCase";

describe("Settings 相关的 UseCase 业务编排", () => {
	const rawMockRepo = {
		getSettings: vi.fn(),
		setDownloadDir: vi.fn(),
		setProxy: vi.fn(),
		setTrackers: vi.fn(),
		setTrackerOptions: vi.fn(),
		setAiConfigs: vi.fn(),
		fetchTrackers: vi.fn(),
		selectDirectory: vi.fn(),
	};
	const mockRepo = rawMockRepo as unknown as SettingsRepository;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("GetSettingsUseCase 应该正确获取配置选项", async () => {
		const useCase = new GetSettingsUseCase(mockRepo);
		vi.mocked(rawMockRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock/dir",
			proxy: null,
			trackers: ["udp://tracker1"],
			ai_configs: [
				{
					alias: "OpenAI",
					api_endpoint: "https://api.openai.com/v1",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
		});
		const result = await useCase.execute();
		expect(rawMockRepo.getSettings).toHaveBeenCalled();
		expect(result).toEqual({
			download_dir: "/mock/dir",
			proxy: null,
			trackers: ["udp://tracker1"],
			ai_configs: [
				{
					alias: "OpenAI",
					api_endpoint: "https://api.openai.com/v1",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
		});
	});

	it("SaveSettingsUseCase 应该调用 repository 里的 setDownloadDir、setProxy、setTrackers 和 setTrackerOptions 方法以及 setAiConfigs 方法", async () => {
		const useCase = new SaveSettingsUseCase(mockRepo);
		vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setTrackers).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setTrackerOptions).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setAiConfigs).mockResolvedValueOnce(undefined);
		await useCase.execute({
			downloadDir: "/mock/dir2",
			proxy: "http://127.0.0.1:1080",
			trackers: ["udp://tracker1"],
			trackerSourceType: "best",
			trackerCdn: "jsdelivr",
			trackerCustomUrl: "",
			trackerAutoUpdate: true,
			trackerLastUpdateTime: 123456,
			aiConfigs: [
				{
					alias: "OpenAI",
					apiEndpoint: "https://api.openai.com/v1",
					apiKey: "test-key",
					model: "gpt-4o",
				},
				{
					alias: "NoModel",
					apiEndpoint: "https://api.nomodel.com/v1",
					apiKey: "test-key-2",
				},
			],
		});
		expect(rawMockRepo.setDownloadDir).toHaveBeenCalledWith("/mock/dir2");
		expect(rawMockRepo.setProxy).toHaveBeenCalledWith("http://127.0.0.1:1080");
		expect(rawMockRepo.setTrackers).toHaveBeenCalledWith(["udp://tracker1"]);
		expect(rawMockRepo.setTrackerOptions).toHaveBeenCalledWith({
			sourceType: "best",
			cdn: "jsdelivr",
			customUrl: "",
			autoUpdate: true,
			lastUpdateTime: 123456,
		});
		expect(rawMockRepo.setAiConfigs).toHaveBeenCalledWith([
			{
				alias: "OpenAI",
				api_endpoint: "https://api.openai.com/v1",
				api_key: "test-key",
				ai_model: "gpt-4o",
			},
			{
				alias: "NoModel",
				api_endpoint: "https://api.nomodel.com/v1",
				api_key: "test-key-2",
				ai_model: null,
			},
		]);
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

	it("SyncTrackersUseCase 应该调用 repository 里的 fetchTrackers 方法", async () => {
		const useCase = new SyncTrackersUseCase(mockRepo);
		vi.mocked(rawMockRepo.fetchTrackers).mockResolvedValueOnce([
			"udp://tracker1",
		]);
		const result = await useCase.execute("https://example.com/trackers.txt");
		expect(rawMockRepo.fetchTrackers).toHaveBeenCalledWith(
			"https://example.com/trackers.txt",
		);
		expect(result).toEqual(["udp://tracker1"]);
	});

	it("SaveSettingsUseCase 在可选参数为空时应该正确传递 null 到 repository 中", async () => {
		const useCase = new SaveSettingsUseCase(mockRepo);
		vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setTrackers).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setTrackerOptions).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setAiConfigs).mockResolvedValueOnce(undefined);
		await useCase.execute({
			downloadDir: "/mock/dir2",
			proxy: null,
			trackers: ["udp://tracker1"],
		});
		expect(rawMockRepo.setTrackerOptions).toHaveBeenCalledWith({
			sourceType: null,
			cdn: null,
			customUrl: null,
			autoUpdate: null,
			lastUpdateTime: null,
		});
		expect(rawMockRepo.setAiConfigs).not.toHaveBeenCalled();
	});

	it("SaveSettingsUseCase 当 aiConfigs 为 null 时应该调用 setAiConfigs(null)", async () => {
		const useCase = new SaveSettingsUseCase(mockRepo);
		vi.mocked(rawMockRepo.setDownloadDir).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setProxy).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setTrackers).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setTrackerOptions).mockResolvedValueOnce(undefined);
		vi.mocked(rawMockRepo.setAiConfigs).mockResolvedValueOnce(undefined);
		await useCase.execute({
			downloadDir: "/mock/dir2",
			proxy: null,
			trackers: ["udp://tracker1"],
			aiConfigs: null,
		});
		expect(rawMockRepo.setAiConfigs).toHaveBeenCalledWith(null);
	});
});
