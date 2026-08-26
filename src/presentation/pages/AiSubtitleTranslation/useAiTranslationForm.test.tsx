import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import type { VideoMetadata } from "@/domain/torrent/TorrentSchemas";
import type { UseAiTranslationFormDeps } from "./useAiTranslationForm";
import { useAiTranslationForm } from "./useAiTranslationForm";

const makeHash = (value: string) => NonEmptyStringSchema.parse(value);

const makeBranded = (value: string) => NonEmptyStringSchema.parse(value);

const makeAiConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  alias: makeBranded("OpenAI GPT-4"),
  api_endpoint: makeBranded("https://api.openai.com/v1/chat/completions"),
  api_key: makeBranded("sk-test"),
  ai_model: makeBranded("gpt-4o"),
  ...overrides,
});

const makeMetadata = (): VideoMetadata => ({
  tracks: [
    { id: 1, language: "eng", title: "English Subtitle", codec: "S_TEXT/UTF8" },
    { id: 2, language: "jpn", title: "Japanese Subtitle", codec: "S_TEXT/ASS" },
  ],
  chapters: [],
  video_info: {
    date_utc: null,
    muxing_app: "",
    writing_app: "",
    video_tracks: [],
    audio_tracks: [],
  },
});

const makeParams = (onTranslateSuccess: () => void = vi.fn()) => ({
  infoHash: makeHash("hash123"),
  fileId: 0,
  onTranslateSuccess,
});

const makeDeps = (
  overrides: Partial<UseAiTranslationFormDeps> = {},
): UseAiTranslationFormDeps => ({
  getSettingsUseCase: {
    execute: vi.fn().mockResolvedValue({
      download_dir: "/mock",
      ai_configs: [makeAiConfig()],
    }),
  },
  getVideoMetadataUseCase: {
    execute: vi.fn().mockResolvedValue(makeMetadata()),
  },
  getSubtitleVttUseCase: {
    execute: vi
      .fn()
      .mockResolvedValue(
        "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
      ),
  },
  translateSubtitleUseCase: {
    execute: vi.fn().mockResolvedValue("rec-uuid-1234"),
  },
  ...overrides,
});

const makeVtt = () =>
  "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n";

describe("useAiTranslationForm 翻译表单 hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该从设置与元数据查询中加载 AI 配置与原始轨道", async () => {
    const params = makeParams();
    const deps = makeDeps();
    const { result } = renderHook(() => useAiTranslationForm(params, deps));

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(1);
      expect(result.current.aiConfigs[0].alias).toBe("OpenAI GPT-4");
      expect(result.current.originalTracks).toHaveLength(2);
    });
  });

  it("当设置或元数据查询失败时，应该回退为空数组", async () => {
    const params = makeParams();
    const deps = makeDeps({
      getSettingsUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("加载设置失败")),
      },
      getVideoMetadataUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("加载元数据失败")),
      },
    });
    const { result } = renderHook(() => useAiTranslationForm(params, deps));

    await waitFor(() => {
      expect(result.current.aiConfigs).toEqual([]);
      expect(result.current.originalTracks).toEqual([]);
    });
  });

  it("填写表单并触发翻译时，应该获取 VTT 并调用翻译 use case，成功后提示并触发回调", async () => {
    const onTranslateSuccess = vi.fn();
    const params = makeParams(onTranslateSuccess);
    const getSubtitleVttExecute = vi.fn().mockResolvedValue(makeVtt());
    const translateExecute = vi.fn().mockResolvedValue("rec-uuid-1234");
    const deps = makeDeps({
      getSubtitleVttUseCase: { execute: getSubtitleVttExecute },
      translateSubtitleUseCase: { execute: translateExecute },
    });
    const { result } = renderHook(() => useAiTranslationForm(params, deps));

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(1);
      expect(result.current.originalTracks).toHaveLength(2);
    });

    act(() => {
      result.current.setSelectedTrackId(1);
      result.current.setSourceLang("eng");
      result.current.setTargetLang("zh");
    });

    await act(async () => {
      result.current.handleTranslate();
    });

    await waitFor(() => {
      expect(getSubtitleVttExecute).toHaveBeenCalledWith({
        infoHash: makeHash("hash123"),
        fileId: 0,
        trackId: 1,
      });
      expect(translateExecute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          infoHash: "hash123",
          fileId: 0,
          originalTrackId: 1,
          sourceLanguage: "eng",
          targetLanguage: "zh",
        }),
      );
      expect(toast.success).toHaveBeenCalledWith("AI 字幕翻译成功");
      expect(onTranslateSuccess).toHaveBeenCalled();
      expect(result.current.translateLoading).toBe(false);
      expect(result.current.translateProgress).toBeNull();
    });
  });

  it("当翻译失败时，应该提示错误 Toast", async () => {
    const params = makeParams();
    const translateExecute = vi
      .fn()
      .mockRejectedValue(new Error("API limit exceeded"));
    const deps = makeDeps({
      translateSubtitleUseCase: { execute: translateExecute },
    });
    const { result } = renderHook(() => useAiTranslationForm(params, deps));

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(1);
      expect(result.current.originalTracks).toHaveLength(2);
    });

    act(() => {
      result.current.setSelectedTrackId(1);
      result.current.setSourceLang("eng");
      result.current.setTargetLang("zh");
    });

    await act(async () => {
      result.current.handleTranslate();
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("翻译失败: API limit exceeded"),
        { duration: 8000 },
      );
      expect(result.current.translateLoading).toBe(false);
    });
  });

  it("翻译执行中应该展示 loading 与进度，结束后清除", async () => {
    let resolveTranslate!: (value: string) => void;
    const translatePromise = new Promise<string>((resolve) => {
      resolveTranslate = resolve;
    });
    const translateExecute = vi
      .fn()
      .mockImplementation(
        (
          _ctx: unknown,
          dto: { onProgress?: (done: number, total: number) => void },
        ) => {
          dto.onProgress?.(3, 10);
          return translatePromise;
        },
      );
    const params = makeParams();
    const deps = makeDeps({
      translateSubtitleUseCase: { execute: translateExecute },
    });
    const { result } = renderHook(() => useAiTranslationForm(params, deps));

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(1);
      expect(result.current.originalTracks).toHaveLength(2);
    });

    act(() => {
      result.current.setSelectedTrackId(1);
      result.current.setSourceLang("eng");
      result.current.setTargetLang("zh");
    });

    act(() => {
      result.current.handleTranslate();
    });

    expect(result.current.translateLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.translateProgress).toEqual({ done: 3, total: 10 });
    });

    await act(async () => {
      resolveTranslate("rec-1");
      await translatePromise;
    });

    await waitFor(() => {
      expect(result.current.translateLoading).toBe(false);
      expect(result.current.translateProgress).toBeNull();
      expect(toast.success).toHaveBeenCalledWith("AI 字幕翻译成功");
    });
  });

  it("切换 AI 配置时，应该使用选中的配置", async () => {
    const translateExecute = vi.fn().mockResolvedValue("rec-1");
    const params = makeParams();
    const deps = makeDeps({
      getSettingsUseCase: {
        execute: vi.fn().mockResolvedValue({
          download_dir: "/mock",
          ai_configs: [
            makeAiConfig(),
            makeAiConfig({
              alias: makeBranded("Claude 3.5 Sonnet"),
              api_endpoint: makeBranded(
                "https://api.anthropic.com/v1/messages",
              ),
              api_key: makeBranded("sk-ant"),
              ai_model: makeBranded("claude-3-5"),
            }),
          ],
        }),
      },
      translateSubtitleUseCase: { execute: translateExecute },
    });
    const { result } = renderHook(() => useAiTranslationForm(params, deps));

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(2);
    });

    act(() => {
      result.current.setSelectedAiIndex(1);
      result.current.setSelectedTrackId(1);
      result.current.setSourceLang("eng");
      result.current.setTargetLang("zh");
    });

    await act(async () => {
      result.current.handleTranslate();
    });

    await waitFor(() => {
      expect(translateExecute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          aiConfig: expect.objectContaining({ alias: "Claude 3.5 Sonnet" }),
        }),
      );
    });
  });
});
