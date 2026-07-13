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
		{
			title: "[Raw] Crystal Sky 480p",
			link: "http://example.com/3",
			pub_date: "2026-07-10",
			magnet: "magnet:?xt=urn:btih:3",
			size: null,
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
			ai_configs: [],
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
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
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
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
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
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
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

	it("当大模型返回的工具参数格式不正确时，应该忽略并继续流程", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValueOnce(mockTorrents);

		const response1Obj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "call_invalid",
								type: "function",
								function: {
									name: "search_torrents",
									arguments: "invalid json string", // will throw in JSON.parse
								},
							},
						],
					},
				},
			],
		};

		const response2Obj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: JSON.stringify([{ index: 0, score: 95, reason: "理由" }]),
					},
				},
			],
		};

		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => response1Obj,
				text: async () => JSON.stringify(response1Obj),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => response2Obj,
				text: async () => JSON.stringify(response2Obj),
			});
		vi.stubGlobal("fetch", mockFetch);

		const useCase = new SearchTorrentsWithAiUseCase(
			mockTorrentRepo,
			mockSettingsRepo,
			new FetchAiClient(new HttpClient()),
			mockLogger,
		);
		const result = await useCase.execute(ctx, {
			keyword: "昨日青空",
			engine: "dmhy",
		});

		expect(result).toBeDefined();
		expect(mockLogger.warn).toHaveBeenCalledWith(
			"解析 AI 传递的工具参数失败",
			expect.any(SyntaxError),
		);
	});

	it("当大模型返回的评分内容不是有效的 JSON 数组时，应该返回未评分的原始结果", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValueOnce(mockTorrents);

		const mockResponseObj = {
			choices: [
				{
					message: {
						content: JSON.stringify({ index: 0, score: 95 }), // Not an array, object instead
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
			keyword: "昨日青空",
			engine: "dmhy",
		});

		expect(result).toEqual(mockTorrents);
		expect(mockLogger.warn).toHaveBeenCalledWith(
			"大模型输出格式不是有效的 JSON 数组，返回无打分的结果",
		);
	});

	it("当部分种子没有获得大模型的评分时，应该保留未评分状态并放在排序末尾", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValueOnce(mockTorrents);

		const mockResponseJson = [{ index: 1, score: 95, reason: "评分 index: 1" }];

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
			keyword: "昨日青空",
			engine: "dmhy",
		});

		expect(result[0].ai_score).toBe(95);
		expect(result[1].ai_score).toBeUndefined();
		expect(result[2].ai_score).toBeUndefined();
	});

	it("当发生一般异常错误时，应该捕获错误并返回原始搜索结果", async () => {
		vi.mocked(mockTorrentRepo.search).mockResolvedValueOnce(mockTorrents);
		vi.mocked(mockSettingsRepo.getSettings).mockRejectedValueOnce(
			new Error("Database error"),
		);

		const useCase = new SearchTorrentsWithAiUseCase(
			mockTorrentRepo,
			mockSettingsRepo,
			new FetchAiClient(new HttpClient()),
			mockLogger,
		);
		const result = await useCase.execute(ctx, {
			keyword: "昨日青空",
			engine: "dmhy",
		});

		expect(result).toBeDefined();
		expect(mockLogger.error).toHaveBeenCalledWith(
			"AI 搜索过滤执行出错，降级回原有搜索结果",
			expect.any(Error),
		);
	});

	it("当发生 Failed to fetch 类型错误时，应该捕获并打印特定错误日志且返回原始搜索结果", async () => {
		vi.mocked(mockTorrentRepo.search).mockResolvedValueOnce(mockTorrents);
		vi.mocked(mockSettingsRepo.getSettings).mockRejectedValueOnce(
			new TypeError("Failed to fetch"),
		);

		const useCase = new SearchTorrentsWithAiUseCase(
			mockTorrentRepo,
			mockSettingsRepo,
			new FetchAiClient(new HttpClient()),
			mockLogger,
		);
		const result = await useCase.execute(ctx, {
			keyword: "昨日青空",
			engine: "dmhy",
		});

		expect(result).toBeDefined();
		expect(mockLogger.error).toHaveBeenCalledWith(
			expect.stringContaining(
				"AI 网络请求被拦截或失败（通常由跨域 CORS 限制或服务未启动导致）。",
			),
			expect.any(TypeError),
		);
	});

	it("当 AI 决策达到最大迭代次数且没有输出评分文本时，应该触发单轮兜底打分评估并成功返回评分结果", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					// ai_model is omitted to trigger default model fallback
				},
			],
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValue(mockTorrents);

		const responseToolObj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "call_tool",
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

		const responseFallbackObj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: JSON.stringify([
							{ index: 0, score: 85, reason: "来自兜底打分" },
						]),
					},
				},
			],
		};

		// 3次 ReAct 循环都返回 tool call, 第4次是兜底打分
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => responseToolObj,
				text: async () => JSON.stringify(responseToolObj),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => responseToolObj,
				text: async () => JSON.stringify(responseToolObj),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => responseToolObj,
				text: async () => JSON.stringify(responseToolObj),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => responseFallbackObj,
				text: async () => JSON.stringify(responseFallbackObj),
			});
		vi.stubGlobal("fetch", mockFetch);

		const useCase = new SearchTorrentsWithAiUseCase(
			mockTorrentRepo,
			mockSettingsRepo,
			new FetchAiClient(new HttpClient()),
			mockLogger,
		);
		const result = await useCase.execute(ctx, {
			keyword: "昨日青空",
			engine: "dmhy",
		});

		expect(mockFetch).toHaveBeenCalledTimes(4);
		expect(result[0].ai_score).toBe(85);
		expect(result[0].ai_reason).toBe("来自兜底打分");
		expect(mockLogger.info).toHaveBeenCalledWith(
			expect.stringContaining(
				"[Agent 兜底] AI 经历了工具调用但没有输出评分文本",
			),
		);
	});

	it("当 AI 决策达到最大迭代次数且兜底打分请求失败时，应该降级返回无评分结果", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValue(mockTorrents);

		const responseToolObj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "call_tool",
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

		// 3次 ReAct 循环都返回 tool call, 第4次兜底打分请求抛出错误
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => responseToolObj,
				text: async () => JSON.stringify(responseToolObj),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => responseToolObj,
				text: async () => JSON.stringify(responseToolObj),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => responseToolObj,
				text: async () => JSON.stringify(responseToolObj),
			})
			.mockRejectedValueOnce(new Error("API Error on Fallback"));
		vi.stubGlobal("fetch", mockFetch);

		const useCase = new SearchTorrentsWithAiUseCase(
			mockTorrentRepo,
			mockSettingsRepo,
			new FetchAiClient(new HttpClient()),
			mockLogger,
		);
		const result = await useCase.execute(ctx, {
			keyword: "昨日青空",
			engine: "dmhy",
		});

		expect(mockFetch).toHaveBeenCalledTimes(4);
		expect(result).toEqual(mockTorrents);
		expect(mockLogger.warn).toHaveBeenCalledWith(
			"AI 兜底打分请求失败",
			expect.any(Error),
		);
	});

	it("当 AI 决策达到最大迭代次数且兜底打分返回空内容时，应该直接返回无评分的原始结果", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValue(mockTorrents);

		const responseToolObj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "call_tool",
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

		const responseFallbackObj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: "", // empty content
					},
				},
			],
		};

		// 3次 ReAct 循环都返回 tool call, 第4次返回空内容
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => responseToolObj,
				text: async () => JSON.stringify(responseToolObj),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => responseToolObj,
				text: async () => JSON.stringify(responseToolObj),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => responseToolObj,
				text: async () => JSON.stringify(responseToolObj),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => responseFallbackObj,
				text: async () => JSON.stringify(responseFallbackObj),
			});
		vi.stubGlobal("fetch", mockFetch);

		const useCase = new SearchTorrentsWithAiUseCase(
			mockTorrentRepo,
			mockSettingsRepo,
			new FetchAiClient(new HttpClient()),
			mockLogger,
		);
		const result = await useCase.execute(ctx, {
			keyword: "昨日青空",
			engine: "dmhy",
		});

		expect(mockFetch).toHaveBeenCalledTimes(4);
		expect(result).toEqual(mockTorrents);
		expect(mockLogger.info).toHaveBeenCalledWith(
			"未获取到有效的 AI 评分推荐内容，返回无打分的结果",
		);
	});

	it("当大模型响应无返回 Choices 消息时，应该退出 ReAct 循环并优雅返回原始结果", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValue(mockTorrents);

		const mockResponseObj = {
			choices: [], // empty choices array
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
			keyword: "昨日青空",
			engine: "dmhy",
		});

		expect(result).toEqual(mockTorrents);
		expect(mockLogger.warn).toHaveBeenCalledWith(
			"大模型响应无返回 Choices 消息，退出 ReAct 循环",
		);
	});

	it("当 AI 决定结束搜索决策过程但返回空内容时，应该直接返回无评分的原始结果", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValue(mockTorrents);

		const mockResponseObj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: null, // empty content triggers "||" fallback
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
			keyword: "昨日青空",
			engine: "dmhy",
		});

		expect(result).toEqual(mockTorrents);
	});

	it("当大模型决定调用非 search_torrents 的其他工具时，应该忽略并继续流程", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValue(mockTorrents);

		const response1Obj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "call_other",
								type: "function",
								function: {
									name: "other_tool", // not search_torrents
									arguments: JSON.stringify({}),
								},
							},
						],
					},
				},
			],
		};

		const response2Obj = {
			choices: [
				{
					message: {
						role: "assistant",
						content: JSON.stringify([{ index: 0, score: 95, reason: "理由" }]),
					},
				},
			],
		};

		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => response1Obj,
				text: async () => JSON.stringify(response1Obj),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => response2Obj,
				text: async () => JSON.stringify(response2Obj),
			});
		vi.stubGlobal("fetch", mockFetch);

		const useCase = new SearchTorrentsWithAiUseCase(
			mockTorrentRepo,
			mockSettingsRepo,
			new FetchAiClient(new HttpClient()),
			mockLogger,
		);
		const result = await useCase.execute(ctx, {
			keyword: "昨日青空",
			engine: "dmhy",
		});

		expect(result).toBeDefined();
	});

	it("当指定了 aiAlias 时，应该匹配对应的别名配置进行 AI 搜索和过滤", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_configs: [
				{
					alias: "Default",
					api_endpoint: "https://api.example.com/v1/chat/completions",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
				{
					alias: "Custom",
					api_endpoint: "https://api.custom.com/v1/chat/completions",
					api_key: "custom-key",
					ai_model: "custom-model",
				},
			],
		});
		vi.mocked(mockTorrentRepo.search).mockResolvedValueOnce(mockTorrents);

		const mockResponseJson = [{ index: 0, score: 95, reason: "符合 1080p" }];

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
			aiAlias: "Custom",
		});

		expect(result).toBeDefined();
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/ai/chat-request"),
			expect.objectContaining({
				body: expect.stringContaining(
					"https://api.custom.com/v1/chat/completions",
				),
			}),
		);
	});

	it("当 AI 开启但配置信息不完整时，应该无缝退化为返回传统搜索结果", async () => {
		vi.mocked(mockSettingsRepo.getSettings).mockResolvedValueOnce({
			download_dir: "/mock",
			ai_configs: [
				{
					alias: "Incomplete",
					api_endpoint: "",
					api_key: "test-key",
					ai_model: "gpt-4o",
				},
			],
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

		expect(result).toEqual(mockTorrents);
	});
});
