import type { Context } from "ajanuw-context";
import type { AiClient } from "../../domain/ai/AiClient";
import type { Logger } from "../../domain/logger/logger";
import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import type {
	AiSearchResultItem,
	SearchResultItem,
} from "../../domain/torrent/TorrentSchemas";

export class SearchTorrentsWithAiUseCase {
	constructor(
		private torrentRepository: TorrentRepository,
		private settingsRepository: SettingsRepository,
		private aiClient: AiClient,
		private logger: Logger,
	) {}

	async execute(
		ctx: Context,
		dto: { keyword: string; engine: string },
	): Promise<AiSearchResultItem[]> {
		this.logger.info("开始执行 AI Agent 智能搜索与推荐流程", dto);

		const rawResults = await this.torrentRepository.search(
			ctx,
			dto.keyword,
			dto.engine,
		);
		this.logger.debug(`传统保底检索完成，找到资源数量: ${rawResults.length}`);

		try {
			const aiSettings = await this.getAiSettings();
			if (!aiSettings) {
				this.logger.info(
					"AI 智能搜索未启用或配置信息不完整，无缝退化为返回传统搜索结果",
				);
				return rawResults;
			}

			return await this.runAiPipeline(ctx, dto, aiSettings, rawResults);
		} catch (error: any) {
			this.handleAiError(error);
			return rawResults;
		}
	}

	private async getAiSettings(): Promise<{
		endpoint: string;
		apiKey: string;
		model: string;
	} | null> {
		const settings = await this.settingsRepository.getSettings();
		if (
			!settings?.ai_enabled ||
			!settings?.ai_api_endpoint ||
			!settings?.ai_api_key
		) {
			return null;
		}
		return {
			endpoint: settings.ai_api_endpoint,
			apiKey: settings.ai_api_key,
			model: settings.ai_model || "gpt-3.5-turbo",
		};
	}

	private async runAiPipeline(
		ctx: Context,
		dto: { keyword: string; engine: string },
		aiSettings: { endpoint: string; apiKey: string; model: string },
		rawResults: SearchResultItem[],
	): Promise<AiSearchResultItem[]> {
		const { endpoint, apiKey, model } = aiSettings;
		this.logger.info("AI 智能 Agent 准备就绪，开始多引擎 ReAct 决策循环", {
			model,
			endpoint,
		});

		let { currentTorrents, content } = await this.executeReActLoop(
			ctx,
			endpoint,
			apiKey,
			model,
			rawResults,
			dto.keyword,
			dto.engine,
		);

		if (!content && currentTorrents.length > 0) {
			content = await this.fallbackEvaluate(
				endpoint,
				apiKey,
				model,
				currentTorrents,
				dto.keyword,
			);
		}

		if (!content) {
			this.logger.info("未获取到有效的 AI 评分推荐内容，返回无打分的结果");
			return currentTorrents;
		}

		return this.parseAndSortRatings(content, currentTorrents);
	}

	private initMessages(keyword: string, engine: string): any[] {
		return [
			{ role: "system", content: this.getSystemPrompt() },
			{
				role: "user",
				content: `用户想看: "${keyword}"。请优先使用搜索引擎: "${engine}" 查找。`,
			},
		];
	}

	private async runSingleReActStep(
		ctx: Context,
		endpoint: string,
		apiKey: string,
		model: string,
		messages: any[],
		tools: any[],
		currentTorrents: SearchResultItem[],
	): Promise<{
		currentTorrents: SearchResultItem[];
		content: string;
		shouldBreak: boolean;
	}> {
		const data = await this.fetchAiResponse(
			endpoint,
			apiKey,
			model,
			messages,
			tools,
		);
		if (data === null) {
			return { currentTorrents, content: "", shouldBreak: true };
		}

		const message = data?.choices?.[0]?.message;
		if (!message) {
			this.logger.warn("大模型响应无返回 Choices 消息，退出 ReAct 循环");
			return { currentTorrents, content: "", shouldBreak: true };
		}
		messages.push(message);

		return this.processReActStep(ctx, message, messages, currentTorrents);
	}

	private async executeReActLoop(
		ctx: Context,
		endpoint: string,
		apiKey: string,
		model: string,
		rawResults: SearchResultItem[],
		keyword: string,
		initialEngine: string,
	): Promise<{ currentTorrents: SearchResultItem[]; content: string }> {
		const tools = this.getTools();
		const messages = this.initMessages(keyword, initialEngine);
		let currentTorrents: SearchResultItem[] = rawResults;
		let content = "";

		for (let i = 0; i < 3; i++) {
			this.logger.info(
				`---- [Agent ReAct 决策] 第 ${i + 1} 轮请求大模型开始 ----`,
				messages,
			);
			const step = await this.runSingleReActStep(
				ctx,
				endpoint,
				apiKey,
				model,
				messages,
				tools,
				currentTorrents,
			);
			currentTorrents = step.currentTorrents;
			content = step.content;
			if (step.shouldBreak) break;
		}
		return { currentTorrents, content };
	}

	private async processReActStep(
		ctx: Context,
		message: any,
		messages: any[],
		currentTorrents: SearchResultItem[],
	): Promise<{
		currentTorrents: SearchResultItem[];
		content: string;
		shouldBreak: boolean;
	}> {
		if (message.tool_calls && message.tool_calls.length > 0) {
			const torrents = await this.handleToolCalls(
				ctx,
				message.tool_calls,
				messages,
				currentTorrents,
			);
			return { currentTorrents: torrents, content: "", shouldBreak: false };
		}
		this.logger.info(
			"[Agent 决策] AI 决定结束搜索决策过程，已产出评分推荐数据",
		);
		return {
			currentTorrents,
			content: message.content || "",
			shouldBreak: true,
		};
	}

	private async fetchAiResponse(
		endpoint: string,
		apiKey: string,
		model: string,
		messages: any[],
		tools: any[],
	): Promise<any> {
		try {
			return await this.aiClient.post(endpoint, apiKey, {
				model,
				messages,
				tools,
				temperature: 0.1,
			});
		} catch (err: unknown) {
			this.logger.warn("AI 过滤网络请求失败，执行降级策略", err);
			return null;
		}
	}

	private async handleToolCalls(
		ctx: Context,
		toolCalls: any[],
		messages: any[],
		currentTorrents: SearchResultItem[],
	): Promise<SearchResultItem[]> {
		let updatedTorrents = currentTorrents;
		this.logger.info(`[Agent 决策] AI 决定调用本地搜索引擎工具获取资源...`);
		for (const toolCall of toolCalls) {
			if (toolCall.function.name === "search_torrents") {
				const res = await this.executeSearchTool(ctx, toolCall);
				if (res.searchResults.length > 0) {
					updatedTorrents = res.searchResults;
				}
				messages.push({
					role: "tool",
					tool_call_id: toolCall.id,
					name: "search_torrents",
					content: res.toolContent,
				});
			}
		}
		return updatedTorrents;
	}

	private async executeSearchTool(
		ctx: Context,
		toolCall: any,
	): Promise<{ searchResults: SearchResultItem[]; toolContent: string }> {
		let args: { keyword: string; engine: string };
		try {
			args = JSON.parse(toolCall.function.arguments);
		} catch (e) {
			this.logger.warn("解析 AI 传递的工具参数失败", e);
			return { searchResults: [], toolContent: "解析参数失败" };
		}

		this.logger.info(
			`[工具执行] 调用 'search_torrents' 引擎: "${args.engine}"，搜索词: "${args.keyword}"`,
		);
		const searchResults = await this.torrentRepository.search(
			ctx,
			args.keyword,
			args.engine,
		);
		this.logger.info(
			`[工具执行结果] 引擎: "${args.engine}" 搜索完毕，找到种子数量: ${searchResults.length}`,
		);

		const itemsToEvaluate = searchResults.slice(0, 30);
		const toolContent =
			itemsToEvaluate.length > 0
				? itemsToEvaluate
						.map(
							(r, idx) =>
								`[索引: ${idx}] 标题: "${r.title}", 大小: ${r.size ? (r.size / 1024 / 1024).toFixed(1) + "MB" : "未知"}`,
						)
						.join("\n")
				: "没有搜到任何结果，列表为空";

		return { searchResults, toolContent };
	}

	private getTools() {
		return [
			{
				type: "function",
				function: {
					name: "search_torrents",
					description:
						"在指定的动漫BT搜索引擎中搜索种子资源，可用于查询磁力资源链接 and 标题",
					parameters: {
						type: "object",
						properties: {
							keyword: {
								type: "string",
								description: "要搜索的番剧关键字或标题",
							},
							engine: {
								type: "string",
								description: "搜索引擎标识",
								enum: ["dmhy", "bangumi_moe", "mikan", "nyaa"],
							},
						},
						required: ["keyword", "engine"],
					},
				},
			},
		];
	}

	private getSystemPrompt(): string {
		return `你是一个专业的动漫BT种子搜索和精选Agent。
你拥有一个 'search_torrents' 工具，可以在不同的搜索引擎中搜索种子。

你的工作流程与核心要求：
1. 提取核心动漫名称：用户的原始输入可能是复杂的自然语言或口语化句子（例如：“看下xxx最新的一集”、“有没有xxx第10集 1080p”、“我想播放xxx”）。
   - 在调用 'search_torrents' 进行搜索时，你必须把“看下”、“我想看”、“求”、“最新的一集”、“最新一集”、“最新的一话”、“最新一话”、“最新的一期”、“最新一期”、“最新”、“第X集”等动作词和具体剧集过滤掉，仅提取出最核心的动漫名称（例如：“xxx”）作为搜索关键字。
   - 千万不要直接拿口语化句子作为 keyword 搜索，搜索引擎会返回空。
2. 灵活搜索：如果默认搜索引擎没有结果，自动尝试其他引擎（"dmhy", "bangumi_moe", "mikan", "nyaa"）或微调核心关键词。
3. 智能评分与排序：
   - 找到结果后，结合用户的原始意图（如“最新一集”、“第10集”、“1080p”）对最后一次搜索到的结果列表进行评分（0-100分）。
   - 如果用户要求“最新一集”或“最新的一话”，你应当重点参考种子的发布日期（越新越好）和标题中的集数信息，将最新发布的、集数最大的种子排在最前面并给出高分，在推荐理由中写明它是最新的原因。
   - 如果用户指定了具体集数（如“第10集”），应给标题中包含该集数的种子打高分，其他集数的种子打低分。
4. 格式要求：最终的回答你必须只返回一个 JSON 数组格式，没有任何 markdown 标记或多余的解释字样，格式如下：
[
  {
    "index": 0,
    "score": 95,
    "reason": "完美匹配用户寻找的最新一集，且为1080p简日双语"
  }
]
注意：'index' 对应你最后一次搜索到的种子列表中种子的索引位置。`;
	}

	private buildEvalPrompt(
		keyword: string,
		torrents: SearchResultItem[],
	): string {
		const itemsToEvaluate = torrents.slice(0, 40);
		const listStr = itemsToEvaluate
			.map((r, idx) => `[索引: ${idx}] 标题: "${r.title}"`)
			.join("\n");
		return `请对以下种子进行打分排序：\n用户意图: "${keyword}"\n列表：\n${listStr}\n请返回只包含 JSON 数组的格式评价。`;
	}

	private async fallbackEvaluate(
		endpoint: string,
		apiKey: string,
		model: string,
		torrents: SearchResultItem[],
		keyword: string,
	): Promise<string> {
		this.logger.info(
			"[Agent 兜底] AI 经历了工具调用但没有输出评分文本，发起一轮单轮打分评估",
		);
		const evalPrompt = this.buildEvalPrompt(keyword, torrents);

		try {
			const data = await this.aiClient.post(endpoint, apiKey, {
				model,
				messages: [
					{
						role: "system",
						content:
							"你是一个专业的 BT 种子相关度评分助手。你只能返回合法的 JSON 数组，不包含任何解释说明文字或 markdown 代码块。",
					},
					{ role: "user", content: evalPrompt },
				],
				temperature: 0.1,
			});
			return data?.choices?.[0]?.message?.content || "";
		} catch (err: unknown) {
			this.logger.warn("AI 兜底打分请求失败", err);
			return "";
		}
	}

	private parseAndSortRatings(
		content: string,
		torrents: SearchResultItem[],
	): AiSearchResultItem[] {
		const cleanContent = content
			.replace(/^```json\s*/i, "")
			.replace(/```\s*$/, "");
		const aiRatings = JSON.parse(cleanContent) as Array<{
			index: number;
			score: number;
			reason: string;
		}>;

		if (!Array.isArray(aiRatings)) {
			this.logger.warn("大模型输出格式不是有效的 JSON 数组，返回无打分的结果");
			return torrents;
		}

		this.logger.info(
			`[打分过滤] 大模型成功评估了 ${aiRatings.length} 个种子的相关性`,
		);

		const aiResults: AiSearchResultItem[] = torrents.map((item, idx) => {
			const rating = aiRatings.find((r) => r.index === idx);
			return rating
				? { ...item, ai_score: rating.score, ai_reason: rating.reason }
				: item;
		});

		const sortedResults = aiResults.sort(
			(a, b) => (b.ai_score ?? -1) - (a.ai_score ?? -1),
		);

		this.logger.info("AI 搜索精选排序完成", {
			bestTitle: sortedResults[0]?.title,
			bestScore: sortedResults[0]?.ai_score,
			bestReason: sortedResults[0]?.ai_reason,
		});

		return sortedResults;
	}

	private handleAiError(error: any): void {
		const isFetchError =
			error instanceof TypeError && error.message === "Failed to fetch";
		if (isFetchError) {
			this.logger.error(
				"AI 网络请求被拦截或失败（通常由跨域 CORS 限制或服务未启动导致）。\n" +
					"排查指引：\n" +
					"1. 请确认本地 AI 服务已正常启动（如 Ollama 是否在后台运行）。\n" +
					"2. 请检查 AI 接口地址 (Endpoint) 是否正确。如果是本地 Ollama，请使用 http://127.0.0.1:11434/v1 （切勿使用 ollama.com 官方网站域名！）。\n" +
					"3. 如果是本地请求被跨域拦截，请以允许跨域方式启动本地模型。例如在 Windows 上，请在终端执行 `set OLLAMA_ORIGINS=*` 之后再运行 `ollama serve`。",
				error,
			);
		} else {
			this.logger.error("AI 搜索过滤执行出错，降级回原有搜索结果", error);
		}
	}
}
