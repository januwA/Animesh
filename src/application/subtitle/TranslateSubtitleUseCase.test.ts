import type { Context } from "ajanuw-context";
import { Background, WithCancel } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiClient } from "../../domain/ai/AiClient";
import type { Logger } from "../../domain/logger/logger";
import type { AiConfig } from "../../domain/settings/SettingsSchemas";
import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import { TranslateSubtitleUseCase } from "./TranslateSubtitleUseCase";

describe("TranslateSubtitleUseCase 测试", () => {
  let mockAiClient: AiClient;
  let mockTranslationRepo: SubtitleTranslationRepository;
  let mockLogger: Logger;
  let ctx: typeof Background;

  const sampleVtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
こんにちは

00:00:02.000 --> 00:00:03.000
世界

00:00:03.000 --> 00:00:04.000
こんにちは
`;

  const defaultAiConfig: AiConfig = {
    alias: "Default",
    api_endpoint: "https://api.example.com/v1/chat/completions",
    api_key: "test-key",
    ai_model: "gpt-4o",
  };

  beforeEach(() => {
    mockAiClient = {
      post: vi.fn(),
    } as unknown as AiClient;

    mockTranslationRepo = {
      getById: vi.fn(),
      listByTorrent: vi.fn(),
      save: vi.fn(),
      deleteById: vi.fn(),
      deleteByTorrent: vi.fn(),
      deleteByInfoHash: vi.fn(),
    } as unknown as SubtitleTranslationRepository;

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      withCategory: () => mockLogger,
    } as unknown as Logger;

    ctx = Background;
  });

  function aiResponse(
    translations: Array<{ index: number; translation: string }>,
  ) {
    return {
      choices: [
        {
          message: {
            content: JSON.stringify(translations),
          },
        },
      ],
    };
  }

  /** execute 返回记录 id，翻译结果通过 save 写入；此函数取出最近一次保存的 VTT 内容 */
  function getSavedVtt(): string {
    return (
      vi.mocked(mockTranslationRepo.save).mock.calls.at(-1)?.[0].vtt_content ??
      ""
    );
  }

  it("AI 配置缺少 api_key 时，应该抛出明确错误提示用户先配置 AI", async () => {
    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await expect(
      useCase.execute(ctx, {
        vtt: sampleVtt,
        sourceLanguage: "auto",
        targetLanguage: "zh",
        aiConfig: { ...defaultAiConfig, api_key: "" },
        onProgress: () => {},
        infoHash: "",
        fileId: 0,
        originalTrackId: 0,
      }),
    ).rejects.toThrow(/AI 配置/);
  });

  it("AI 配置未指定模型时，应该使用配置中的模型调用 AI", async () => {
    vi.mocked(mockAiClient.post).mockResolvedValueOnce(
      aiResponse([{ index: 0, translation: "你好" }]),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
こんにちは
`,
      sourceLanguage: "ja",
      targetLanguage: "zh",
      aiConfig: { ...defaultAiConfig, ai_model: "gpt-3.5-turbo" },
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    expect(mockAiClient.post).toHaveBeenCalledTimes(1);
    expect(mockAiClient.post).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      "test-key",
      expect.objectContaining({ model: "gpt-3.5-turbo" }),
    );
    expect(getSavedVtt()).toContain("你好");
  });

  it("AI 返回空内容时，应该保留原文且不抛错", async () => {
    vi.mocked(mockAiClient.post).mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
こんにちは
`,
      sourceLanguage: "ja",
      targetLanguage: "zh",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    expect(getSavedVtt()).toContain("こんにちは");
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockAiClient.post).toHaveBeenCalledTimes(1);
  });

  it("源语言为自动识别时，应该正常完成翻译", async () => {
    vi.mocked(mockAiClient.post).mockResolvedValueOnce(
      aiResponse([{ index: 0, translation: "你好" }]),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
こんにちは
`,
      sourceLanguage: "auto",
      targetLanguage: "zh",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    expect(mockAiClient.post).toHaveBeenCalledTimes(1);
    expect(getSavedVtt()).toContain("你好");
  });

  it("应该解析 VTT、去重文本、调 AI 翻译并回填重建 VTT", async () => {
    // 去重后只剩 2 条文本：こんにちは / 世界
    vi.mocked(mockAiClient.post).mockResolvedValueOnce(
      aiResponse([
        { index: 0, translation: "你好" },
        { index: 1, translation: "世界" },
      ]),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: sampleVtt,
      sourceLanguage: "ja",
      targetLanguage: "zh",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    // AI 只被调用一次（去重后一批就完成）
    expect(mockAiClient.post).toHaveBeenCalledTimes(1);
    const savedVtt = getSavedVtt();
    expect(savedVtt).toContain("你好");
    // 去重的"こんにちは"对应两条 cue 都应该是"你好"
    const youLines = savedVtt.match(/你好/g) ?? [];
    expect(youLines.length).toBe(2);
    expect(savedVtt).not.toContain("こんにちは");
  });

  it("当文本数量超过批次大小时，应该分批调用 AI", async () => {
    const cues: string[] = ["WEBVTT", ""];
    const expectedTranslations: Array<{ index: number; translation: string }> =
      [];
    for (let i = 0; i < 65; i++) {
      cues.push(
        `00:00:${String(i).padStart(2, "0")}.000 --> 00:00:${String(i + 1).padStart(2, "0")}.000`,
      );
      cues.push(`原文${i}`);
      cues.push("");
      expectedTranslations.push({ index: i, translation: `译文${i}` });
    }
    const vtt = cues.join("\n");

    // 默认批次 30，65 条文本需要 3 批：30 + 30 + 5
    // 注意：AI 返回的 index 是批内序号（0..29 / 0..29 / 0..4）
    const batch1 = expectedTranslations
      .slice(0, 30)
      .map((t, i) => ({ index: i, translation: t.translation }));
    const batch2 = expectedTranslations
      .slice(30, 60)
      .map((t, i) => ({ index: i, translation: t.translation }));
    const batch3 = expectedTranslations
      .slice(60, 65)
      .map((t, i) => ({ index: i, translation: t.translation }));
    vi.mocked(mockAiClient.post)
      .mockResolvedValueOnce(aiResponse(batch1))
      .mockResolvedValueOnce(aiResponse(batch2))
      .mockResolvedValueOnce(aiResponse(batch3));

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt,
      sourceLanguage: "ja",
      targetLanguage: "zh",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    expect(mockAiClient.post).toHaveBeenCalledTimes(3);
    const savedVtt = getSavedVtt();
    expect(savedVtt).toContain("译文0");
    expect(savedVtt).toContain("译文64");
    expect(savedVtt).not.toContain("原文0");
  });

  it("应该通过 onProgress 报告翻译进度（done, total）", async () => {
    vi.mocked(mockAiClient.post)
      .mockResolvedValueOnce(aiResponse([{ index: 0, translation: "你好" }]))
      .mockResolvedValueOnce(aiResponse([{ index: 1, translation: "世界" }]));

    const onProgress = vi.fn();
    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    // 用 batchSize: 1 强制分两批
    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好

00:00:02.000 --> 00:00:03.000
世界
`,
      sourceLanguage: "zh",
      targetLanguage: "en",
      aiConfig: defaultAiConfig,
      onProgress,
      batchSize: 1,
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, 0, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(3, 2, 2);
  });

  it("当 AI 返回非合法 JSON 时，该批文本应保留原文且不抛错", async () => {
    vi.mocked(mockAiClient.post).mockResolvedValueOnce({
      choices: [{ message: { content: "not a json" } }],
    });

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`,
      sourceLanguage: "zh",
      targetLanguage: "en",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    expect(getSavedVtt()).toContain("你好");
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("AI 返回内容无法解析为翻译结果"),
      expect.anything(),
    );
  });

  it("当 AI 返回的某条 translation 缺失时，对应文本应保留原文", async () => {
    // 只返回 index 0 的译文，index 1 缺失
    vi.mocked(mockAiClient.post).mockResolvedValueOnce(
      aiResponse([{ index: 0, translation: "Hello" }]),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好

00:00:02.000 --> 00:00:03.000
世界
`,
      sourceLanguage: "zh",
      targetLanguage: "en",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    const savedVtt = getSavedVtt();
    expect(savedVtt).toContain("Hello");
    // 缺失翻译的"世界"应保留原文
    expect(savedVtt).toContain("世界");
  });

  it("当 context 被取消时，应该停止后续批次并抛出取消错误", async () => {
    vi.mocked(mockAiClient.post).mockResolvedValueOnce(
      aiResponse([{ index: 0, translation: "Hello" }]),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    const [cancelableCtx, cancel] = WithCancel(Background);

    // 在第一次批次返回后立即取消
    const onProgress = () => {
      cancel();
    };

    await expect(
      useCase.execute(cancelableCtx as Context, {
        vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好

00:00:02.000 --> 00:00:03.000
世界
`,
        sourceLanguage: "zh",
        targetLanguage: "en",
        aiConfig: defaultAiConfig,
        onProgress,
        batchSize: 1,
        infoHash: "",
        fileId: 0,
        originalTrackId: 0,
      }),
    ).rejects.toThrow(/取消/);
  });

  it("当 AI 返回 402 额度用完错误时，应该立即抛出终止翻译而非静默降级", async () => {
    vi.mocked(mockAiClient.post).mockRejectedValueOnce(
      new Error(
        'HTTP error status 402 Payment Required: {"error":"You have depleted your monthly included credits."}',
      ),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await expect(
      useCase.execute(ctx, {
        vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`,
        sourceLanguage: "zh",
        targetLanguage: "en",
        aiConfig: defaultAiConfig,
        onProgress: () => {},
        infoHash: "",
        fileId: 0,
        originalTrackId: 0,
      }),
    ).rejects.toThrow(/额度/);
  });

  it("当 AI 返回 401 认证失败错误时，应该立即抛出终止翻译", async () => {
    vi.mocked(mockAiClient.post).mockRejectedValueOnce(
      new Error("HTTP error! status: 401 Unauthorized"),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await expect(
      useCase.execute(ctx, {
        vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`,
        sourceLanguage: "zh",
        targetLanguage: "en",
        aiConfig: defaultAiConfig,
        onProgress: () => {},
        infoHash: "",
        fileId: 0,
        originalTrackId: 0,
      }),
    ).rejects.toThrow(/认证/);
  });

  it("当 AI 返回 403 权限错误时，应该立即抛出终止翻译", async () => {
    vi.mocked(mockAiClient.post).mockRejectedValueOnce(
      new Error("HTTP error! status: 403 Forbidden"),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await expect(
      useCase.execute(ctx, {
        vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`,
        sourceLanguage: "zh",
        targetLanguage: "en",
        aiConfig: defaultAiConfig,
        onProgress: () => {},
        infoHash: "",
        fileId: 0,
        originalTrackId: 0,
      }),
    ).rejects.toThrow(/权限/);
  });

  it("当 AI 返回 429 限流错误时，应该降级保留原文而非终止（暂时性错误）", async () => {
    vi.mocked(mockAiClient.post).mockRejectedValueOnce(
      new Error("HTTP error! status: 429 Too Many Requests"),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`,
      sourceLanguage: "zh",
      targetLanguage: "en",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    // 429 是暂时性错误，降级保留原文
    expect(getSavedVtt()).toContain("你好");
  });

  it("当 AI 返回网络错误（非 HTTP 状态码）时，应该降级保留原文", async () => {
    vi.mocked(mockAiClient.post).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`,
      sourceLanguage: "zh",
      targetLanguage: "en",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    expect(getSavedVtt()).toContain("你好");
  });

  it("使用传入的 aiConfig 时，应该使用对应配置的接口地址与模型", async () => {
    vi.mocked(mockAiClient.post).mockResolvedValueOnce(
      aiResponse([{ index: 0, translation: "Hello" }]),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`,
      sourceLanguage: "zh",
      targetLanguage: "en",
      aiConfig: {
        alias: "Custom",
        api_endpoint: "https://api.custom.com/v1/chat/completions",
        api_key: "custom-key",
        ai_model: "custom-model",
      },
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    const [endpoint, apiKey, payload] = vi.mocked(mockAiClient.post).mock
      .calls[0];
    expect(endpoint).toBe("https://api.custom.com/v1/chat/completions");
    expect(apiKey).toBe("custom-key");
    const body = payload as { model: string };
    expect(body.model).toBe("custom-model");
  });

  it("重复翻译同一轨道时，每次都应调用 AI 并保存一条新的独立记录", async () => {
    vi.mocked(mockAiClient.post).mockResolvedValue(
      aiResponse([{ index: 0, translation: "你好" }]),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    const dto = {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
こんにちは
`,
      sourceLanguage: "ja",
      targetLanguage: "zh",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "abc",
      fileId: 1,
      originalTrackId: 2,
    };

    await useCase.execute(ctx, dto);
    await useCase.execute(ctx, dto);

    // 两次都真实调用 AI，不做缓存短路
    expect(mockAiClient.post).toHaveBeenCalledTimes(2);
    // 每次保存一条新记录，且 UUID 不同
    expect(mockTranslationRepo.save).toHaveBeenCalledTimes(2);
    const firstId = vi.mocked(mockTranslationRepo.save).mock.calls[0][0].id;
    const secondId = vi.mocked(mockTranslationRepo.save).mock.calls[1][0].id;
    expect(firstId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(secondId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(firstId).not.toBe(secondId);
  });

  it("字幕没有任何 cue 时，应该保存空 VTT 记录且不调用 AI", async () => {
    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: "WEBVTT",
      sourceLanguage: "ja",
      targetLanguage: "zh",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    expect(getSavedVtt()).toBe("WEBVTT\n");
    expect(mockAiClient.post).not.toHaveBeenCalled();
  });

  it("翻译成功且提供记录上下文时，应该把结果保存为新记录", async () => {
    vi.mocked(mockAiClient.post).mockResolvedValueOnce(
      aiResponse([{ index: 0, translation: "你好" }]),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
こんにちは
`,
      sourceLanguage: "ja",
      targetLanguage: "zh",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "abc",
      fileId: 1,
      originalTrackId: 2,
    });

    expect(getSavedVtt()).toContain("你好");
    expect(mockTranslationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
        info_hash: "abc",
        file_id: 1,
        original_track_id: 2,
        source_lang: "ja",
        target_lang: "zh",
        vtt_content: expect.stringContaining("你好"),
      }),
    );
  });

  it("写入记录失败时，应该抛出错误让调用方感知记录未保存", async () => {
    vi.mocked(mockTranslationRepo.save).mockRejectedValueOnce(
      new Error("db locked"),
    );
    vi.mocked(mockAiClient.post).mockResolvedValueOnce(
      aiResponse([{ index: 0, translation: "你好" }]),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await expect(
      useCase.execute(ctx, {
        vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
こんにちは
`,
        sourceLanguage: "ja",
        targetLanguage: "zh",
        aiConfig: defaultAiConfig,
        onProgress: () => {},
        infoHash: "abc",
        fileId: 1,
        originalTrackId: 2,
      }),
    ).rejects.toThrow("db locked");
  });

  it("AI 返回合法 JSON 但结构不是翻译数组时，该批文本应保留原文", async () => {
    vi.mocked(mockAiClient.post).mockResolvedValueOnce({
      choices: [{ message: { content: '[{"foo": "bar"}]' } }],
    });

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`,
      sourceLanguage: "zh",
      targetLanguage: "en",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    expect(getSavedVtt()).toContain("你好");
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("无法解析为翻译结果"),
      expect.anything(),
    );
  });

  it("AI 接口以非 Error 值 reject 时，应按暂时性错误降级保留原文", async () => {
    vi.mocked(mockAiClient.post).mockRejectedValueOnce("boom");

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`,
      sourceLanguage: "zh",
      targetLanguage: "en",
      aiConfig: defaultAiConfig,
      onProgress: () => {},
      infoHash: "",
      fileId: 0,
      originalTrackId: 0,
    });

    expect(getSavedVtt()).toContain("你好");
  });

  it("即使 infoHash 为空，翻译成功后也会无条件保存记录", async () => {
    vi.mocked(mockAiClient.post).mockResolvedValueOnce(
      aiResponse([{ index: 0, translation: "Hello" }]),
    );

    const useCase = new TranslateSubtitleUseCase(
      mockAiClient,
      mockTranslationRepo,
      mockLogger,
    );

    await useCase.execute(ctx, {
      vtt: `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`,
      sourceLanguage: "zh",
      targetLanguage: "en",
      aiConfig: defaultAiConfig,
      infoHash: "",
      onProgress: () => {},
      fileId: 0,
      originalTrackId: 0,
    });

    expect(mockTranslationRepo.save).toHaveBeenCalledTimes(1);
  });
});
