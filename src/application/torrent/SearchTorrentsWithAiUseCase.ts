import type { Context } from "ajanuw-context";
import {
  type NonEmptyString,
  NonEmptyStringSchema,
} from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { Logged } from "@/infrastructure/logger/LoggedDecorator";
import type { AiClient } from "../../domain/ai/AiClient";
import type { Logger } from "../../domain/logger/logger";
import {
  TORRENT_SEARCH_ENGINES,
  type TorrentSearchEngine,
} from "../../domain/torrent/TorrentEngines";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import type {
  AiSearchResultItem,
  SearchResultItem,
} from "../../domain/torrent/TorrentSchemas";
import type { GetAiConfigsUseCase } from "../settings/GetAiConfigsUseCase";

export interface ChatCompletionToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionMessage {
  role: string;
  content?: string | null;
  tool_calls?: ChatCompletionToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ChatCompletionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionResponse {
  choices?: {
    message?: ChatCompletionMessage;
  }[];
}

export class SearchTorrentsWithAiUseCase {
  constructor(
    private torrentRepository: TorrentRepository,
    private getAiConfigsUseCase: GetAiConfigsUseCase,
    private aiClient: AiClient,
    public logger: Logger,
  ) {}

  @Logged({ excludeArgs: [0] })
  async execute(
    ctx: Context,
    dto: {
      keyword: NonEmptyString;
      engine: TorrentSearchEngine;
      aiAlias: NonEmptyString;
    },
  ): Promise<AiSearchResultItem[]> {
    const rawResults = await this.torrentRepository.search(
      ctx,
      dto.keyword,
      dto.engine,
    );
    try {
      const aiConfig = await this.getAiSettings(dto.aiAlias);
      if (!aiConfig) {
        return rawResults;
      }
      return await this.runAiPipeline(ctx, dto, aiConfig, rawResults);
    } catch (_error: unknown) {
      return rawResults;
    }
  }

  @Logged()
  private async getAiSettings(
    aiAlias: NonEmptyString,
  ): Promise<AiConfig | undefined> {
    const { aiConfigs } = await this.getAiConfigsUseCase.execute();
    if (aiConfigs.length > 0) {
      return aiConfigs.find((c) => c.alias === aiAlias);
    }
  }

  @Logged({ excludeArgs: [0] })
  private async runAiPipeline(
    ctx: Context,
    dto: { keyword: NonEmptyString; engine: TorrentSearchEngine },
    aiConfig: AiConfig,
    rawResults: SearchResultItem[],
  ): Promise<AiSearchResultItem[]> {
    let { currentTorrents, content } = await this.executeReActLoop(
      ctx,
      aiConfig,
      rawResults,
      dto.keyword,
      dto.engine,
    );

    if (!content && currentTorrents.length > 0) {
      content = await this.fallbackEvaluate(
        ctx,
        aiConfig,
        currentTorrents,
        dto.keyword,
      );
    }

    if (!content) {
      return currentTorrents;
    }

    return this.parseAndSortRatings(content, currentTorrents);
  }

  private initMessages(
    keyword: string,
    engine: TorrentSearchEngine,
  ): ChatCompletionMessage[] {
    return [
      { role: "system", content: this.getSystemPrompt() },
      {
        role: "user",
        content: `用户想看: "${keyword}"。请优先使用搜索引擎: "${engine}" 查找。`,
      },
    ];
  }

  @Logged({ excludeArgs: [0] })
  private async runSingleReActStep(
    ctx: Context,
    aiConfig: AiConfig,
    messages: ChatCompletionMessage[],
    tools: ChatCompletionTool[],
    currentTorrents: SearchResultItem[],
  ): Promise<{
    currentTorrents: SearchResultItem[];
    content: string;
    shouldBreak: boolean;
  }> {
    const data = await this.fetchAiResponse(ctx, aiConfig, messages, tools);
    if (data === null) {
      return { currentTorrents, content: "", shouldBreak: true };
    }

    const message = data?.choices?.[0]?.message;
    if (!message) {
      return { currentTorrents, content: "", shouldBreak: true };
    }
    messages.push(message);

    return this.processReActStep(ctx, message, messages, currentTorrents);
  }

  @Logged({ excludeArgs: [0] })
  private async executeReActLoop(
    ctx: Context,
    aiConfig: AiConfig,
    rawResults: SearchResultItem[],
    keyword: NonEmptyString,
    initialEngine: TorrentSearchEngine,
  ): Promise<{ currentTorrents: SearchResultItem[]; content: string }> {
    const tools = this.getTools();
    const messages = this.initMessages(keyword, initialEngine);
    let currentTorrents: SearchResultItem[] = rawResults;
    let content = "";

    for (let i = 0; i < 3; i++) {
      const step = await this.runSingleReActStep(
        ctx,
        aiConfig,
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

  @Logged({ excludeArgs: [0] })
  private async processReActStep(
    ctx: Context,
    message: ChatCompletionMessage,
    messages: ChatCompletionMessage[],
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
    return {
      currentTorrents,
      content: message.content || "",
      shouldBreak: true,
    };
  }
  @Logged({ excludeArgs: [0] })
  private async fetchAiResponse(
    ctx: Context,
    aiConfig: AiConfig,
    messages: ChatCompletionMessage[],
    tools: ChatCompletionTool[],
  ): Promise<ChatCompletionResponse | null> {
    const res = await this.aiClient.post(
      ctx,
      aiConfig.api_endpoint,
      aiConfig.api_key,
      {
        model: aiConfig.ai_model,
        messages,
        tools,
        temperature: 0.1,
      },
    );
    return res as ChatCompletionResponse;
  }
  @Logged({ excludeArgs: [0] })
  private async handleToolCalls(
    ctx: Context,
    toolCalls: ChatCompletionToolCall[],
    messages: ChatCompletionMessage[],
    currentTorrents: SearchResultItem[],
  ): Promise<SearchResultItem[]> {
    let updatedTorrents = currentTorrents;
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
  @Logged({ excludeArgs: [0] })
  private async executeSearchTool(
    ctx: Context,
    toolCall: ChatCompletionToolCall,
  ): Promise<{ searchResults: SearchResultItem[]; toolContent: string }> {
    let args: { keyword: string; engine: TorrentSearchEngine };
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (_e) {
      return { searchResults: [], toolContent: "解析参数失败" };
    }

    const searchResults = await this.torrentRepository.search(
      ctx,
      NonEmptyStringSchema.parse(args.keyword),
      args.engine,
    );

    const itemsToEvaluate = searchResults.slice(0, 30);
    const toolContent =
      itemsToEvaluate.length > 0
        ? itemsToEvaluate
            .map((r, idx) => `[索引: ${idx}] 标题: "${r.title}"`)
            .join("\n")
        : "没有搜到任何结果，列表为空";

    return { searchResults, toolContent };
  }

  private getTools(): ChatCompletionTool[] {
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
                enum: [...TORRENT_SEARCH_ENGINES],
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
2. 灵活搜索：如果默认搜索引擎没有结果，自动尝试其他引擎（${TORRENT_SEARCH_ENGINES.map((e) => `"${e}"`).join(", ")}）或微调核心关键词。
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
  @Logged({ excludeArgs: [0] })
  private async fallbackEvaluate(
    ctx: Context,
    aiConfig: AiConfig,
    torrents: SearchResultItem[],
    keyword: NonEmptyString,
  ): Promise<string> {
    const evalPrompt = this.buildEvalPrompt(keyword, torrents);
    const data = (await this.aiClient.post(
      ctx,
      aiConfig.api_endpoint,
      aiConfig.api_key,
      {
        model: aiConfig.ai_model,
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的 BT 种子相关度评分助手。你只能返回合法的 JSON 数组，不包含任何解释说明文字或 markdown 代码块。",
          },
          { role: "user", content: evalPrompt },
        ],
        temperature: 0.1,
      },
    )) as ChatCompletionResponse;
    return data?.choices?.[0]?.message?.content || "";
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
      return torrents;
    }

    const aiResults: AiSearchResultItem[] = torrents.map((item, idx) => {
      const rating = aiRatings.find((r) => r.index === idx);
      return rating
        ? { ...item, ai_score: rating.score, ai_reason: rating.reason }
        : item;
    });

    const sortedResults = aiResults.sort(
      (a, b) => (b.ai_score ?? -1) - (a.ai_score ?? -1),
    );

    return sortedResults;
  }
}
