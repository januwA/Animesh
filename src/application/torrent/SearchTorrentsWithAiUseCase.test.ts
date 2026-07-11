import { Background } from "ajanuw-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../domain/logger/logger";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import { FetchAiClient } from "../../infrastructure/ai/FetchAiClient";
import { HttpClient } from "../../infrastructure/http/HttpClient";
import { SearchTorrentsWithAiUseCase } from "./SearchTorrentsWithAiUseCase";

describe("SearchTorrentsWithAiUseCase 测试", () => {
	let mockTorrentRepo: TorrentRepository;
	let mockSettingsRepo: SettingsRepository;
	let mockLogger: Logger;
	let ctx: typeof Background;

	const mockTorrents = [
		{
			title: "[DMG] 昨日青空 Crystal Sky [1080p] [GB]",
			link: "http://example.com/1",
			pub_date: "2026-07-10",
			magnet: "magnet:?xt=urn:btih:1",
			size: 1024 * 1024 * 1500,
		},
		{
			title: "[Sub] Crystal Sky 720p",
			link: "http://example.com/2",
			pub_date: "2026-07-10",
			magnet: "magnet:?xt=urn:btih:2",
			size: 1024 * 1024 * 800,
		},
	];

	beforeEach(() => {
		mockTorrentRepo = {
			search: vi.fn(),
		} as unknown as TorrentRepository;

		mockSettingsRepo = {
			getSettings: vi.fn(),
		} as unknown as SettingsRepository;

		mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			withCategory: () => mockLogger,
		} as unknown as Logger;

		ctx = Background;
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("当 AI 未开启时，应该直接调用 repository 搜索并返回原结果", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_enabled: false,
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValueOnce(mockTorrents);

		const useCase = new SearchTorrentsWithAiUseCase(
			mockTorrentRepo,
			mockSettingsRepo,
			new FetchAiClient(new HttpClient()),
			mockLogger,
		);
		const result = await useCase.execute(ctx, {
			keyword: "昨日青空 1080p",
			engine: "dmhy",
		});

		expect(mockTorrentRepo.search).toHaveBeenCalledWith(
			ctx,
			"昨日青空 1080p",
			"dmhy",
		);
		expect(globalThis.fetch).not.toHaveBeenCalled();
		expect(result).toEqual(mockTorrents);
	});

	it("当 AI 开启时，应该进行搜索并调用大模型进行过滤、评分和排序", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_enabled: true,
			ai_api_key: "test-key",
			ai_api_endpoint: "https://api.example.com/v1/chat/completions",
			ai_model: "gpt-4o",
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValueOnce(mockTorrents);

		const mockResponseJson = [
			{ index: 0, score: 95, reason: "符合 1080p 分辨率且大小正常" },
			{ index: 1, score: 60, reason: "分辨率为 720p，非 1080p" },
		];

		const mockResponseObj = {
			choices: [
				{
					message: {
						content: JSON.stringify(mockResponseJson),
					},
				},
			],
		};
		const mockFetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => mockResponseObj,
			text: async () => JSON.stringify(mockResponseObj),
		});
		vi.stubGlobal("fetch", mockFetch);

		const useCase = new SearchTorrentsWithAiUseCase(
			mockTorrentRepo,
			mockSettingsRepo,
			new FetchAiClient(new HttpClient()),
			mockLogger,
		);
		const result = await useCase.execute(ctx, {
			keyword: "昨日青空 1080p",
			engine: "dmhy",
		});

		expect(mockTorrentRepo.search).toHaveBeenCalledWith(
			ctx,
			"昨日青空 1080p",
			"dmhy",
		);
		expect(mockFetch).toHaveBeenCalled();

		// 检查 fetch 参数
		const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toContain("/api/ai/chat-request");
		expect(options.headers).toEqual({
			"Content-Type": "application/json",
		});
		expect(JSON.parse(options.body as string)).toEqual({
			endpoint: "https://api.example.com/v1/chat/completions",
			api_key: "test-key",
			body_json: expect.any(String),
		});

		// 检查结果是否包含打分和推荐理由，并按分数倒序排列
		expect(result[0].title).toBe("[DMG] 昨日青空 Crystal Sky [1080p] [GB]");
		expect(result[0].ai_score).toBe(95);
		expect(result[0].ai_reason).toBe("符合 1080p 分辨率且大小正常");

		expect(result[1].title).toBe("[Sub] Crystal Sky 720p");
		expect(result[1].ai_score).toBe(60);
		expect(result[1].ai_reason).toBe("分辨率为 720p，非 1080p");
	});

	it("当大模型接口异常或返回无法解析时，应该优雅退化返回无打分的原搜索结果", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_enabled: true,
			ai_api_key: "test-key",
			ai_api_endpoint: "https://api.example.com/v1/chat/completions",
			ai_model: "gpt-4o",
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValueOnce(mockTorrents);

		const mockFetch = vi.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
		});
		vi.stubGlobal("fetch", mockFetch);

		const useCase = new SearchTorrentsWithAiUseCase(
			mockTorrentRepo,
			mockSettingsRepo,
			new FetchAiClient(new HttpClient()),
			mockLogger,
		);
		const result = await useCase.execute(ctx, {
			keyword: "昨日青空 1080p",
			engine: "dmhy",
		});

		expect(result).toEqual(mockTorrents);
	});

	it("应该支持大模型通过 Tool Calling 多次调用搜索引擎工具，并在无结果时自动切换搜索引擎", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_enabled: true,
			ai_api_key: "test-key",
			ai_api_endpoint: "https://api.example.com/v1/chat/completions",
			ai_model: "gpt-4o",
		});

		// 模拟 TorrentRepository 的多次调用：
		// 1. 初始检索 dmhy 返回空列表
		// 2. 第一次 tool call 搜索 dmhy 返回空列表
		// 3. 第二次 tool call 搜索 bangumi_moe 返回有结果的列表
		const mockSearch = vi
			.fn()
			.mockResolvedValueOnce([]) // 初始检索 dmhy
			.mockResolvedValueOnce([]) // 第一轮 tool call (dmhy)
			.mockResolvedValueOnce(mockTorrents); // 第二轮 tool call (bangumi_moe)
		mockTorrentRepo.search = mockSearch;

		const response1Obj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "call_1",
								type: "function",
								function: {
									name: "search_torrents",
									arguments: JSON.stringify({
										keyword: "昨日青空",
										engine: "dmhy",
									}),
								},
							},
						],
					},
				},
			],
		};
		const response1 = {
			ok: true,
			json: async () => response1Obj,
			text: async () => JSON.stringify(response1Obj),
		};

		// 第二次请求：大模型收到空结果，决定切换到 bangumi_moe 搜索
		const response2Obj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "call_2",
								type: "function",
								function: {
									name: "search_torrents",
									arguments: JSON.stringify({
										keyword: "昨日青空",
										engine: "bangumi_moe",
									}),
								},
							},
						],
					},
				},
			],
		};
		const response2 = {
			ok: true,
			json: async () => response2Obj,
			text: async () => JSON.stringify(response2Obj),
		};

		// 第三次请求：大模型在 bangumi_moe 搜到结果，进行打分过滤
		const response3Obj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: JSON.stringify([
							{ index: 0, score: 90, reason: "1080p 简体中文" },
							{ index: 1, score: 65, reason: "720p 资源" },
						]),
					},
				},
			],
		};
		const response3 = {
			ok: true,
			json: async () => response3Obj,
			text: async () => JSON.stringify(response3Obj),
		};

		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce(response1)
			.mockResolvedValueOnce(response2)
			.mockResolvedValueOnce(response3);
		vi.stubGlobal("fetch", mockFetch);

		const useCase = new SearchTorrentsWithAiUseCase(
			mockTorrentRepo,
			mockSettingsRepo,
			new FetchAiClient(new HttpClient()),
			mockLogger,
		);
		const result = await useCase.execute(ctx, {
			keyword: "想看昨日青空1080p",
			engine: "dmhy",
		});

		// 验证一共调用了 3 次 fetch
		expect(mockFetch).toHaveBeenCalledTimes(3);

		// 验证 repository 的 search 被调用了 3 次，分别是保底检索和两轮工具调用
		expect(mockSearch).toHaveBeenCalledTimes(3);
		expect(mockSearch.mock.calls[0]).toEqual([
			ctx,
			"想看昨日青空1080p",
			"dmhy",
		]);
		expect(mockSearch.mock.calls[1]).toEqual([ctx, "昨日青空", "dmhy"]);
		expect(mockSearch.mock.calls[2]).toEqual([ctx, "昨日青空", "bangumi_moe"]);

		// 验证结果是重排过的，带有打分和原因
		expect(result[0].title).toBe("[DMG] 昨日青空 Crystal Sky [1080p] [GB]");
		expect(result[0].ai_score).toBe(90);
		expect(result[0].ai_reason).toBe("1080p 简体中文");
	});
});
