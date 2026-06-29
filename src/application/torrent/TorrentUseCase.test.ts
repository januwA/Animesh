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
});
