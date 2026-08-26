import type { Context } from "ajanuw-context";
import { z } from "zod";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiClient } from "../../domain/ai/AiClient";
import type { Logger } from "../../domain/logger/logger";
import {
  type AiConfig,
  AiConfigSchema,
} from "../../domain/settings/SettingsSchemas";
import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import type { SubtitleTranslationRecord } from "../../domain/subtitle/SubtitleTranslationSchemas";
import type { VttDocument } from "./vtt";
import { buildVtt, extractUniqueTexts, parseVtt } from "./vtt";

export interface TranslateSubtitleDto {
  /** 原始 VTT 字幕内容 */
  vtt: string;
  sourceLanguage: string;
  targetLanguage: string;
  /** 使用的 AI 配置，必须是当前已配置的配置对象 */
  aiConfig: AiConfig;
  /** 翻译进度回调，参数为 (已完成条数, 总条数)。不需要时传 noop 函数。 */
  onProgress: (done: number, total: number) => void;
  /** 每批翻译的最大文本条数，默认 30 */
  batchSize?: number;
  infoHash: string;
  fileId: number;
  originalTrackId: number;
}

const DEFAULT_BATCH_SIZE = 30;

const TranslationItemSchema = z.object({
  index: z.number().int(),
  translation: z.string(),
});

const TranslationResponseSchema = z.array(TranslationItemSchema);

/**
 * 使用大模型把 VTT 字幕从源语言翻译为目标语言，并把结果保存到 SQLite。
 *
 * 工作流程：
 * 1. 解析 VTT、提取去重后的字幕文本（同一次调用内的相同文本只翻译一次）。
 * 2. 按批次调用大模型，每批返回 JSON 数组形式的译文。
 * 3. 用 Zod 校验返回结构，校验失败时保留原文，不抛错。
 * 4. 每批之间检查 Context 是否被取消，被取消时停止后续批次。
 * 5. 把译文回填到原 VTT 结构并返回。
 * 6. 翻译成功后写入一条新记录（INSERT）
 *
 * 设计原则：
 * - 每次显式翻译都会生成一条新记录（UUID 主键），保留翻译历史。
 * - 同一轨道重复翻译会新增一条记录，不覆盖旧译文，前端可同时展示全部翻译。
 * - 不可恢复错误（401/402/403）立即终止，不写记录。
 * - 暂时性错误（429/5xx/网络）降级保留原文，也不写记录。
 */
export class TranslateSubtitleUseCase {
  constructor(
    private aiClient: AiClient,
    private translationRepository: SubtitleTranslationRepository,
    private logger: Logger,
  ) {}

  async execute(ctx: Context, dto: TranslateSubtitleDto): Promise<string> {
    this.logStart(dto);

    if (!AiConfigSchema.safeParse(dto.aiConfig).success) {
      throw new Error(
        "AI 配置未启用或信息不完整，请先在设置中配置 AI 接口后再使用字幕翻译功能。",
      );
    }

    // 1. 解析 VTT 并翻译
    const doc = parseVtt(dto.vtt);
    const uniqueTexts = extractUniqueTexts(doc);

    if (uniqueTexts.length === 0) {
      const record = await this.saveTranslationRecord(
        dto,
        buildVtt(doc, new Map()),
      );
      return record.id;
    }

    const translatedVtt = await this.translateAll(ctx, dto, doc, uniqueTexts);

    // 2. 写入一条新记录（即使译文质量不佳也保留，用户已消耗 Token）
    const record = await this.saveTranslationRecord(dto, translatedVtt);

    return record.id;
  }

  private logStart(dto: TranslateSubtitleDto): void {
    this.logger.info("开始执行 AI 字幕翻译流程", dto);
  }

  private async translateAll(
    ctx: Context,
    dto: TranslateSubtitleDto,
    doc: VttDocument,
    uniqueTexts: string[],
  ): Promise<string> {
    const translationMap = new Map<string, string>();
    const batchSize = dto.batchSize ?? DEFAULT_BATCH_SIZE;
    const total = uniqueTexts.length;
    let done = 0;

    // 立即发一次 0/N 进度回调，保证 UI 在第一批 AI 请求返回前就显示进度框
    dto.onProgress(0, total);

    for (let i = 0; i < total; i += batchSize) {
      if (ctx.err() !== null) {
        throw new Error("字幕翻译已被取消");
      }

      const batch = uniqueTexts.slice(i, i + batchSize);
      const batchTranslations = await this.translateBatch(
        dto.aiConfig,
        dto.sourceLanguage,
        dto.targetLanguage,
        batch,
      );

      for (let j = 0; j < batch.length; j++) {
        const original = batch[j];
        const translated = batchTranslations.get(j);
        translationMap.set(original, translated ?? original);
      }

      done += batch.length;
      dto.onProgress(done, total);
    }

    return buildVtt(doc, translationMap);
  }

  private async saveTranslationRecord(
    dto: TranslateSubtitleDto,
    translatedVtt: string,
  ): Promise<SubtitleTranslationRecord> {
    const record = this.buildTranslationRecord(dto, translatedVtt);
    await this.translationRepository.save(record);
    this.logger.info("字幕翻译结果已保存为新记录", {
      recordId: record.id,
      targetLang: dto.targetLanguage,
      aiConfig: dto.aiConfig.alias,
    });
    return record;
  }

  private buildTranslationRecord(
    dto: TranslateSubtitleDto,
    translatedVtt: string,
  ): SubtitleTranslationRecord {
    const now = Date.now();
    return {
      id: NonEmptyStringSchema.parse(crypto.randomUUID()),
      info_hash: NonEmptyStringSchema.parse(dto.infoHash),
      file_id: dto.fileId,
      original_track_id: dto.originalTrackId,
      source_lang: NonEmptyStringSchema.parse(dto.sourceLanguage),
      target_lang: NonEmptyStringSchema.parse(dto.targetLanguage),
      vtt_content: translatedVtt,
      created_at: now,
      last_accessed_at: now,
    };
  }

  private async translateBatch(
    aiConfig: AiConfig,
    sourceLanguage: string,
    targetLanguage: string,
    texts: string[],
  ): Promise<Map<number, string>> {
    const payload = {
      model: aiConfig.ai_model,
      messages: [
        {
          role: "system",
          content: this.buildSystemPrompt(sourceLanguage, targetLanguage),
        },
        {
          role: "user",
          content: JSON.stringify(
            texts.map((text, index) => ({ index, text })),
          ),
        },
      ],
      temperature: 0.1,
    };

    let res: unknown;
    try {
      res = await this.aiClient.post(
        aiConfig.api_endpoint,
        aiConfig.api_key,
        payload,
      );
    } catch (err: unknown) {
      const tip = this.extractUnrecoverableTip(err);
      if (tip !== null) throw new Error(tip, { cause: err });
      this.logger.warn("AI 字幕翻译批次请求失败，已降级保留原文", err);
      return new Map();
    }

    return this.parseBatchResponse(res);
  }

  private parseBatchResponse(res: unknown): Map<number, string> {
    const messageContent =
      (res as { choices?: { message?: { content?: string | null } }[] })
        ?.choices?.[0]?.message?.content ?? "";
    const cleaned = messageContent
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = cleaned === "" ? [] : JSON.parse(cleaned);
    } catch (err: unknown) {
      this.logger.warn("AI 返回内容无法解析为翻译结果，已降级保留原文", err);
      return new Map();
    }

    const result = TranslationResponseSchema.safeParse(parsed);
    if (!result.success) {
      this.logger.warn(
        "AI 返回内容无法解析为翻译结果，已降级保留原文",
        result.error,
      );
      return new Map();
    }

    const map = new Map<number, string>();
    for (const item of result.data) {
      map.set(item.index, item.translation);
    }
    return map;
  }

  private buildSystemPrompt(
    sourceLanguage: string,
    targetLanguage: string,
  ): string {
    const sourceDesc =
      sourceLanguage === "auto" ? "自动识别的源语言" : sourceLanguage;
    return `你是一个专业的字幕翻译助手。请把用户给出的字幕文本数组从${sourceDesc}翻译成${targetLanguage}。

严格要求：
1. 只返回 JSON 数组，不要任何 markdown 标记（如 \`\`\`json）或解释文字。
2. 数组每个元素形如 {"index": 0, "translation": "译文"}，index 必须与用户输入一一对应。
3. 保留原文中的换行符 \\n，不要合并多行。
4. 人名、专有名词保留原文或采用公认译名。
5. 若原文为空字符串，译文也返回空字符串。
6. 不要漏翻任何条目，每个 index 都必须在返回数组中出现。`;
  }

  /**
   * 检测错误是否为不可恢复的 HTTP 4xx 错误（401/402/403）。
   * 这类错误通常是认证失败、额度用完、权限不足，继续重试只会浪费请求，
   * 应该立即终止整个翻译流程并提示用户。
   *
   * 兼容两种错误信息格式：
   * - FetchHttpClient: "HTTP error! status: 402 Payment Required"
   * - Rust 后端 ai_chat_request: "HTTP error status 402 Payment Required: {...}"
   *
   * 429（限流）、408（超时）、5xx、网络错误等视为暂时性错误，返回 null 走降级路径。
   */
  private extractUnrecoverableTip(err: unknown): string | null {
    if (!(err instanceof Error)) return null;
    const match = err.message.match(/status:?\s*(\d{3})/i);
    if (!match) return null;
    const code = parseInt(match[1], 10);
    const tips: Record<number, string> = {
      401: "AI 接口认证失败，请检查 API Key 是否正确",
      402: "AI 额度已用完，请充值或更换模型配置",
      403: "AI 接口拒绝访问，可能是权限不足或区域限制",
    };
    return tips[code] ?? null;
  }
}
