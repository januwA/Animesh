import { describe, expect, it, vi } from "vitest";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { AddTorrentMagnetUseCase } from "./AddTorrentMagnetUseCase";
import { DeleteTorrentUseCase } from "./DeleteTorrentUseCase";
import { GetSubtitleTracksUseCase } from "./GetSubtitleTracksUseCase";
import { GetSubtitleVttUseCase } from "./GetSubtitleVttUseCase";
import { GetTorrentFilesUseCase } from "./GetTorrentFilesUseCase";
import { GetTorrentStatusUseCase } from "./GetTorrentStatusUseCase";
import { GetTorrentStreamUrlUseCase } from "./GetTorrentStreamUrlUseCase";
import { ListTorrentsUseCase } from "./ListTorrentsUseCase";
import { PauseTorrentUseCase } from "./PauseTorrentUseCase";
import { ResolveTorrentUseCase } from "./ResolveTorrentUseCase";
import { ResumeTorrentUseCase } from "./ResumeTorrentUseCase";
import { SearchTorrentsUseCase } from "./SearchTorrentsUseCase";

describe("Torrent 相关的 UseCase 业务编排", () => {
	const mockRepo = {
		search: vi.fn(),
		listTorrents: vi.fn(),
		pauseTorrent: vi.fn(),
		resumeTorrent: vi.fn(),
		deleteTorrent: vi.fn(),
		addTorrentMagnet: vi.fn(),
		getTorrentFiles: vi.fn(),
		getTorrentStreamUrl: vi.fn(),
		getTorrentStatus: vi.fn(),
		getSubtitleTracks: vi.fn(),
		getSubtitleVtt: vi.fn(),
		subscribeTorrents: vi.fn().mockResolvedValue(() => {}),
	} as unknown as TorrentRepository;

	it("SearchTorrentsUseCase 应该正确调用 repository 的 search 方法", async () => {
		const useCase = new SearchTorrentsUseCase(mockRepo);
		vi.mocked(mockRepo.search).mockResolvedValueOnce([
			{ name: "test anime", magnet: "magnet:?xt=urn:btih:123" } as any,
		]);
		const results = await useCase.execute("test", "mikan");
		expect(mockRepo.search).toHaveBeenCalledWith("test", "mikan");
		expect(results).toEqual([
			{ name: "test anime", magnet: "magnet:?xt=urn:btih:123" },
		]);
	});

	it("ListTorrentsUseCase 应该正确调用 repository 的 listTorrents 方法", async () => {
		const useCase = new ListTorrentsUseCase(mockRepo);
		vi.mocked(mockRepo.listTorrents).mockResolvedValueOnce([
			{ info_hash: "123", finished: true } as any,
		]);
		const results = await useCase.execute();
		expect(mockRepo.listTorrents).toHaveBeenCalled();
		expect(results).toEqual([{ info_hash: "123", finished: true }]);
	});

	it("PauseTorrentUseCase 应该正确调用 repository 的 pauseTorrent 方法", async () => {
		const useCase = new PauseTorrentUseCase(mockRepo);
		vi.mocked(mockRepo.pauseTorrent).mockResolvedValueOnce(undefined);
		await useCase.execute("123");
		expect(mockRepo.pauseTorrent).toHaveBeenCalledWith("123");
	});

	it("ResumeTorrentUseCase 应该正确调用 repository 的 resumeTorrent 方法", async () => {
		const useCase = new ResumeTorrentUseCase(mockRepo);
		vi.mocked(mockRepo.resumeTorrent).mockResolvedValueOnce(undefined);
		await useCase.execute("123");
		expect(mockRepo.resumeTorrent).toHaveBeenCalledWith("123");
	});

	it("DeleteTorrentUseCase 应该正确调用 repository 的 deleteTorrent 方法", async () => {
		const useCase = new DeleteTorrentUseCase(mockRepo);
		vi.mocked(mockRepo.deleteTorrent).mockResolvedValueOnce(undefined);
		await useCase.execute("123", true);
		expect(mockRepo.deleteTorrent).toHaveBeenCalledWith("123", true);
	});

	it("AddTorrentMagnetUseCase 应该正确调用 repository 的 addTorrentMagnet 方法", async () => {
		const useCase = new AddTorrentMagnetUseCase(mockRepo);
		vi.mocked(mockRepo.addTorrentMagnet).mockResolvedValueOnce({
			info_hash: "123",
			files: [],
		} as any);
		const result = await useCase.execute("magnet:?xt=urn:btih:123");
		expect(mockRepo.addTorrentMagnet).toHaveBeenCalledWith(
			"magnet:?xt=urn:btih:123",
		);
		expect(result).toEqual({ info_hash: "123", files: [] });
	});

	it("GetTorrentFilesUseCase 应该正确调用 repository 的 getTorrentFiles 方法", async () => {
		const useCase = new GetTorrentFilesUseCase(mockRepo);
		vi.mocked(mockRepo.getTorrentFiles).mockResolvedValueOnce([
			{ id: 1, name: "video.mp4" } as any,
		]);
		const results = await useCase.execute("123");
		expect(mockRepo.getTorrentFiles).toHaveBeenCalledWith("123");
		expect(results).toEqual([{ id: 1, name: "video.mp4" }]);
	});

	it("GetTorrentStatusUseCase 应该正确调用 repository 的 getTorrentStatus 方法", async () => {
		const useCase = new GetTorrentStatusUseCase(mockRepo);
		vi.mocked(mockRepo.getTorrentStatus).mockResolvedValueOnce({
			info_hash: "123",
			progress_bytes: 100,
		} as any);
		const result = await useCase.execute("123");
		expect(mockRepo.getTorrentStatus).toHaveBeenCalledWith("123");
		expect(result).toEqual({ info_hash: "123", progress_bytes: 100 });
	});

	it("GetTorrentStreamUrlUseCase 应该正确调用 repository 的 getTorrentStreamUrl 方法", async () => {
		const useCase = new GetTorrentStreamUrlUseCase(mockRepo);
		vi.mocked(mockRepo.getTorrentStreamUrl).mockResolvedValueOnce(
			"http://localhost:8080/stream/123/1",
		);
		const result = await useCase.execute("123", 1);
		expect(mockRepo.getTorrentStreamUrl).toHaveBeenCalledWith("123", 1);
		expect(result).toBe("http://localhost:8080/stream/123/1");
	});

	it("GetSubtitleTracksUseCase 应该正确调用 repository 的 getSubtitleTracks 方法", async () => {
		const useCase = new GetSubtitleTracksUseCase(mockRepo);
		vi.mocked(mockRepo.getSubtitleTracks).mockResolvedValueOnce([
			{ id: 1, lang: "chi" } as any,
		]);
		const results = await useCase.execute("123", 1);
		expect(mockRepo.getSubtitleTracks).toHaveBeenCalledWith("123", 1);
		expect(results).toEqual([{ id: 1, lang: "chi" }]);
	});

	it("GetSubtitleVttUseCase 应该正确调用 repository 的 getSubtitleVtt 方法", async () => {
		const useCase = new GetSubtitleVttUseCase(mockRepo);
		vi.mocked(mockRepo.getSubtitleVtt).mockResolvedValueOnce("WEBVTT\n...");
		const result = await useCase.execute("123", 1, 2);
		expect(mockRepo.getSubtitleVtt).toHaveBeenCalledWith("123", 1, 2);
		expect(result).toBe("WEBVTT\n...");
	});

	it("ResolveTorrentUseCase 应该在提供 magnet 时正确调用 repository 的 addTorrentMagnet 方法并返回结果", async () => {
		const useCase = new ResolveTorrentUseCase(mockRepo);
		const mockResult = {
			info_hash: "123",
			name: "test magnet torrent",
			files: [],
		};
		vi.mocked(mockRepo.addTorrentMagnet).mockResolvedValueOnce(mockResult);

		const result = await useCase.execute({ magnet: "magnet:?xt=urn:btih:123" });
		expect(mockRepo.addTorrentMagnet).toHaveBeenCalledWith(
			"magnet:?xt=urn:btih:123",
		);
		expect(result).toEqual(mockResult);
	});

	it("ResolveTorrentUseCase 应该在只提供 infoHash 时正确调用 repository 的 getTorrentFiles 方法并组合返回结果", async () => {
		const useCase = new ResolveTorrentUseCase(mockRepo);
		const mockFiles = [{ id: 1, name: "file1.mp4", size: 100 }];
		vi.mocked(mockRepo.getTorrentFiles).mockResolvedValueOnce(mockFiles);

		const result = await useCase.execute({
			infoHash: "123",
			title: "测试种子",
		});
		expect(mockRepo.getTorrentFiles).toHaveBeenCalledWith("123");
		expect(result).toEqual({
			info_hash: "123",
			name: "测试种子",
			files: mockFiles,
		});
	});

	it("ResolveTorrentUseCase 在提供 infoHash 且未提供 title 时应该使用默认的已缓存种子名称", async () => {
		const useCase = new ResolveTorrentUseCase(mockRepo);
		const mockFiles = [{ id: 1, name: "file1.mp4", size: 100 }];
		vi.mocked(mockRepo.getTorrentFiles).mockResolvedValueOnce(mockFiles);

		const result = await useCase.execute({ infoHash: "123" });
		expect(result).toEqual({
			info_hash: "123",
			name: "已缓存种子",
			files: mockFiles,
		});
	});

	it("ResolveTorrentUseCase 在没有提供 magnet 和 infoHash 时应该抛出错误", async () => {
		const useCase = new ResolveTorrentUseCase(mockRepo);
		await expect(useCase.execute({})).rejects.toThrow(
			"未提供有效的磁力链接或种子 Hash",
		);
	});
});
