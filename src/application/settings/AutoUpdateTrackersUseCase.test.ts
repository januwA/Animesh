import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutoUpdateTrackersUseCase } from "./AutoUpdateTrackersUseCase";

describe("AutoUpdateTrackersUseCase 自动同步更新用例", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.resetAllMocks();
		vi.useRealTimers();
	});

	it("如果未开启自动更新，应该直接返回 null 并跳过更新", async () => {
		const settingsRepoMock = {
			getSettings: vi.fn().mockResolvedValue({
				download_dir: "C:\\Downloads",
				tracker_auto_update: false,
			}),
			setTrackers: vi.fn(),
			setTrackerOptions: vi.fn(),
			fetchTrackers: vi.fn(),
			selectDirectory: vi.fn(),
		} as any;
		const useCase = new AutoUpdateTrackersUseCase(settingsRepoMock);
		const result = await useCase.execute();
		expect(result).toBeNull();
		expect(settingsRepoMock.getSettings).toHaveBeenCalled();
		expect(settingsRepoMock.fetchTrackers).not.toHaveBeenCalled();
	});

	it("如果距离上次更新未满 24 小时，应该直接返回 null 并跳过更新", async () => {
		const now = Date.now();
		const settingsRepoMock = {
			getSettings: vi.fn().mockResolvedValue({
				download_dir: "C:\\Downloads",
				tracker_auto_update: true,
				tracker_last_update_time: now - 12 * 60 * 60 * 1000, // 12 hours ago
			}),
			setTrackers: vi.fn(),
			setTrackerOptions: vi.fn(),
			fetchTrackers: vi.fn(),
			selectDirectory: vi.fn(),
		} as any;
		const useCase = new AutoUpdateTrackersUseCase(settingsRepoMock);
		const result = await useCase.execute();
		expect(result).toBeNull();
		expect(settingsRepoMock.getSettings).toHaveBeenCalled();
		expect(settingsRepoMock.fetchTrackers).not.toHaveBeenCalled();
	});

	it("如果已开启且超过 24 小时，应该执行拉取并保存，最后返回同步的数量", async () => {
		const settingsRepoMock = {
			getSettings: vi.fn().mockResolvedValue({
				download_dir: "C:\\Downloads",
				proxy: "http://127.0.0.1:7890",
				trackers: ["udp://oldtracker:80"],
				tracker_auto_update: true,
				tracker_last_update_time: 0,
				tracker_source_type: "best",
				tracker_cdn: "jsdelivr",
			}),
			setTrackers: vi.fn().mockResolvedValue(undefined),
			setTrackerOptions: vi.fn().mockResolvedValue(undefined),
			fetchTrackers: vi
				.fn()
				.mockResolvedValue(["udp://new1:80", "http://new2:80"]),
			selectDirectory: vi.fn(),
		} as any;
		const useCase = new AutoUpdateTrackersUseCase(settingsRepoMock);
		const result = await useCase.execute();
		expect(result).toBe(2);
		expect(settingsRepoMock.getSettings).toHaveBeenCalled();
		expect(settingsRepoMock.fetchTrackers).toHaveBeenCalledWith(
			"https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_best.txt",
		);
		expect(settingsRepoMock.setTrackers).toHaveBeenCalledWith([
			"udp://new1:80",
			"http://new2:80",
		]);
		expect(settingsRepoMock.setTrackerOptions).toHaveBeenCalledWith({
			sourceType: "best",
			cdn: "jsdelivr",
			customUrl: "",
			autoUpdate: true,
			lastUpdateTime: expect.any(Number),
		});
	});
});
