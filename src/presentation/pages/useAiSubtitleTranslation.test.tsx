import { act, render } from "@testing-library/react";
import { useState } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GetSettingsUseCase } from "@/application/settings/GetSettingsUseCase";
import { GetSubtitleTranslationsUseCase } from "@/application/subtitle/GetSubtitleTranslationsUseCase";
import type { TranslateSubtitleUseCase } from "@/application/subtitle/TranslateSubtitleUseCase";
import type { SubtitleTranslationRepository } from "@/domain/subtitle/SubtitleTranslationRepository";
import type { SubtitleTranslationRecord } from "@/domain/subtitle/SubtitleTranslationSchemas";
import {
  type SubtitleTrackItem,
  type UseAiSubtitleTranslationParams,
  type UseAiSubtitleTranslationResult,
  useAiSubtitleTranslation,
} from "./Player";

// setup 只 mock 了 success/error/warning，补上 info 供缓存加载成功提示使用
Object.assign(toast, { info: vi.fn() });

describe("useAiSubtitleTranslation Hook", () => {
  const subtitleTranslationRepository = {
    getById: vi.fn(),
    listByTorrent: vi.fn(),
    save: vi.fn(),
    deleteById: vi.fn(),
    deleteByTorrent: vi.fn(),
    deleteByInfoHash: vi.fn(),
  } as unknown as SubtitleTranslationRepository;

  const getSubtitleTranslationsUseCase = new GetSubtitleTranslationsUseCase(
    subtitleTranslationRepository,
  );

  const translateSubtitleUseCase = {
    execute: vi.fn(),
  } as unknown as TranslateSubtitleUseCase;

  const getSettingsUseCase = {
    execute: vi.fn(),
  } as unknown as GetSettingsUseCase;

  const originalSubtitleTracks: SubtitleTrackItem[] = [
    { id: 2, language: "ja", title: "日语字幕", codec: "subrip" },
  ];

  const defaultAiSettings = {
    download_dir: "/mock",
    ai_configs: [
      {
        alias: "Default",
        api_endpoint: "https://api.example.com/v1/chat/completions",
        api_key: "key",
        ai_model: "gpt-4o",
      },
    ],
  };

  const cachedRecord: SubtitleTranslationRecord = {
    id: "record-1",
    info_hash: "abc",
    file_id: 1,
    original_track_id: 2,
    source_lang: "ja",
    target_lang: "zh",
    vtt_content: "WEBVTT\n\n缓存的译文",
    created_at: 1000,
    last_accessed_at: 1000,
  };

  type HookRef = {
    current: UseAiSubtitleTranslationResult | null;
    selectedTrackId: number | null;
    setSelectedTrackId: ((id: number | null) => void) | null;
  };

  function renderHook(
    params: Omit<
      UseAiSubtitleTranslationParams,
      "selectedTrackId" | "setSelectedTrackId"
    >,
    initialSelectedTrackId: number | null = null,
  ) {
    const hookRef: HookRef = {
      current: null,
      selectedTrackId: null,
      setSelectedTrackId: null,
    };

    const Harness = () => {
      const [selectedTrackId, setSelectedTrackId] = useState<number | null>(
        initialSelectedTrackId,
      );
      const result = useAiSubtitleTranslation({
        ...params,
        selectedTrackId,
        setSelectedTrackId,
      });
      hookRef.current = result;
      hookRef.selectedTrackId = selectedTrackId;
      hookRef.setSelectedTrackId = setSelectedTrackId;
      return null;
    };

    render(<Harness />);
    return hookRef;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(toast.info).mockReset();
    vi.mocked(getSettingsUseCase.execute).mockResolvedValue(defaultAiSettings);
    vi.mocked(subtitleTranslationRepository.listByTorrent).mockResolvedValue(
      [],
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-ai-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("进入播放器时应该加载字幕翻译记录作为 AI 轨道", async () => {
    vi.mocked(
      subtitleTranslationRepository.listByTorrent,
    ).mockResolvedValueOnce([
      {
        id: "record-1",
        info_hash: "abc",
        file_id: 1,
        original_track_id: 2,
        source_lang: "ja",
        target_lang: "zh",
        vtt_content: "",
        created_at: 1000,
        last_accessed_at: 1000,
      },
    ]);
    vi.mocked(subtitleTranslationRepository.getById).mockResolvedValueOnce(
      cachedRecord,
    );

    const hookRef = renderHook({
      getSubtitleTranslationsUseCase,
      translateSubtitleUseCase,
      getSettingsUseCase,
      infoHash: "abc",
      fileId: 1,
      metadataReady: true,
      originalSubtitleTracks,
      getSubtitleUrl: () => undefined,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(subtitleTranslationRepository.listByTorrent).toHaveBeenCalledWith(
      "abc",
      1,
    );
    expect(subtitleTranslationRepository.getById).toHaveBeenCalledWith(
      "record-1",
    );
    expect(hookRef.current?.aiSubtitleTracks[1_000_000]).toMatchObject({
      aiTrackId: 1_000_000,
      originalTrackId: 2,
      targetLanguage: "zh",
      title: "日语字幕 · AI(zh) #1",
      language: "zh",
    });
    // AI 轨道应合并进字幕轨道列表
    expect(hookRef.current?.subtitleTracks).toHaveLength(2);
    expect(hookRef.current?.subtitleTracks[1]).toMatchObject({
      id: 1_000_000,
      isAi: true,
    });
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("已加载 1 条缓存的 AI 字幕轨道"),
    );
  });

  it("缓存列表为空时不应该调用 getById 或创建任何轨道", async () => {
    const hookRef = renderHook({
      getSubtitleTranslationsUseCase,
      translateSubtitleUseCase,
      getSettingsUseCase,
      infoHash: "abc",
      fileId: 1,
      metadataReady: true,
      originalSubtitleTracks,
      getSubtitleUrl: () => undefined,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(subtitleTranslationRepository.getById).not.toHaveBeenCalled();
    expect(hookRef.current?.aiSubtitleTracks).toEqual({});
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("缓存记录 getById 返回 null 时应跳过该条", async () => {
    vi.mocked(
      subtitleTranslationRepository.listByTorrent,
    ).mockResolvedValueOnce([
      {
        id: "record-1",
        info_hash: "abc",
        file_id: 1,
        original_track_id: 2,
        source_lang: "ja",
        target_lang: "zh",
        vtt_content: "",
        created_at: 1000,
        last_accessed_at: 1000,
      },
    ]);
    vi.mocked(subtitleTranslationRepository.getById).mockResolvedValueOnce(
      null,
    );

    const hookRef = renderHook({
      getSubtitleTranslationsUseCase,
      translateSubtitleUseCase,
      getSettingsUseCase,
      infoHash: "abc",
      fileId: 1,
      metadataReady: true,
      originalSubtitleTracks,
      getSubtitleUrl: () => undefined,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(hookRef.current?.aiSubtitleTracks).toEqual({});
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("加载缓存失败时应记录 console.error 且不抛错", async () => {
    vi.mocked(
      subtitleTranslationRepository.listByTorrent,
    ).mockRejectedValueOnce(new Error("db locked"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const hookRef = renderHook({
      getSubtitleTranslationsUseCase,
      translateSubtitleUseCase,
      getSettingsUseCase,
      infoHash: "abc",
      fileId: 1,
      metadataReady: true,
      originalSubtitleTracks,
      getSubtitleUrl: () => undefined,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(hookRef.current?.aiSubtitleTracks).toEqual({});
  });

  it("应默认选中第一个 AI 配置", async () => {
    const hookRef = renderHook({
      getSubtitleTranslationsUseCase,
      translateSubtitleUseCase,
      getSettingsUseCase,
      infoHash: "abc",
      fileId: 1,
      metadataReady: false,
      originalSubtitleTracks,
      getSubtitleUrl: () => undefined,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(hookRef.current?.aiConfigs).toHaveLength(1);
    expect(hookRef.current?.translateAiIndex).toBe(0);
  });

  it("未选择字幕轨道时打开翻译对话框应提示", async () => {
    const hookRef = renderHook({
      getSubtitleTranslationsUseCase,
      translateSubtitleUseCase,
      getSettingsUseCase,
      infoHash: "abc",
      fileId: 1,
      metadataReady: false,
      originalSubtitleTracks,
      getSubtitleUrl: () => undefined,
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      hookRef.current?.handleOpenTranslateDialog();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("请先选择字幕轨道"),
    );
    expect(hookRef.current?.translateDialogOpen).toBe(false);
  });

  it("原始字幕尚未加载完成时打开翻译对话框应提示", async () => {
    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl: () => undefined,
      },
      2,
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      hookRef.current?.handleOpenTranslateDialog();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("字幕尚未加载完成"),
    );
    expect(hookRef.current?.translateDialogOpen).toBe(false);
  });

  it("未配置 AI 时打开翻译对话框应提示", async () => {
    vi.mocked(getSettingsUseCase.execute).mockResolvedValueOnce({
      download_dir: "/mock",
      ai_configs: [],
    });

    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl: () => "blob:mock-subtitle-url",
      },
      2,
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      hookRef.current?.handleOpenTranslateDialog();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("配置 AI 接口"),
    );
    expect(hookRef.current?.translateDialogOpen).toBe(false);
  });

  it("条件满足时打开翻译对话框应成功", async () => {
    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl: () => "blob:mock-subtitle-url",
      },
      2,
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      hookRef.current?.handleOpenTranslateDialog();
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(hookRef.current?.translateDialogOpen).toBe(true);
  });

  it("选中 AI 轨道时打开翻译对话框应回退到原始轨道 id 判断字幕是否就绪", async () => {
    // 先翻译一次，产生 AI 轨道（id 从计数器分配为 1_000_000，对应原始轨道 2）
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nこんにちは", {
        status: 200,
      }),
    );
    vi.mocked(translateSubtitleUseCase.execute).mockResolvedValueOnce(
      "WEBVTT\n\n你好",
    );
    const getSubtitleUrl = vi.fn(() => "blob:mock-subtitle-url");
    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl,
      },
      2,
    );
    // 等待 settings 查询完成，确保已选中的 AI 配置索引有效
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await hookRef.current?.handleConfirmTranslate();
    });
    const aiTrackId = hookRef.current
      ? Object.keys(hookRef.current.aiSubtitleTracks).map(Number)[0]
      : 0;
    expect(aiTrackId).toBe(1_000_000);

    act(() => {
      hookRef.setSelectedTrackId?.(aiTrackId);
    });
    act(() => {
      hookRef.current?.handleOpenTranslateDialog();
    });

    // AI 轨道应回退到其原始轨道 id 2 判断字幕是否就绪
    expect(getSubtitleUrl).toHaveBeenCalledWith(2);
    expect(hookRef.current?.translateDialogOpen).toBe(true);
  });

  it("未选择字幕轨道时确认翻译应直接返回", async () => {
    const hookRef = renderHook({
      getSubtitleTranslationsUseCase,
      translateSubtitleUseCase,
      getSettingsUseCase,
      infoHash: "abc",
      fileId: 1,
      metadataReady: false,
      originalSubtitleTracks,
      getSubtitleUrl: () => "blob:mock-subtitle-url",
    });

    await act(async () => {
      await hookRef.current?.handleConfirmTranslate();
    });

    expect(translateSubtitleUseCase.execute).not.toHaveBeenCalled();
  });

  it("字幕内容读取失败时确认翻译应提示且不调用 AI", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError("network"));

    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl: () => "blob:mock-subtitle-url",
      },
      2,
    );
    // 等待 settings 查询完成，确保已选中的 AI 配置索引有效
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await hookRef.current?.handleConfirmTranslate();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("读取字幕内容失败"),
    );
    expect(translateSubtitleUseCase.execute).not.toHaveBeenCalled();
  });

  it("确认翻译应读取字幕内容并调用 UseCase（携带缓存上下文）", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nこんにちは", {
        status: 200,
      }),
    );
    vi.mocked(translateSubtitleUseCase.execute).mockResolvedValueOnce(
      "WEBVTT\n\n你好",
    );

    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl: () => "blob:mock-subtitle-url",
      },
      2,
    );

    // 先刷新 settings 查询，确保自动选中第一个 AI 配置别名
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      hookRef.current?.setTranslateTargetLang("zh");
    });
    await act(async () => {
      await hookRef.current?.handleConfirmTranslate();
    });

    expect(translateSubtitleUseCase.execute).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        vtt: expect.stringContaining("こんにちは"),
        sourceLanguage: "",
        targetLanguage: "zh",
        aiConfig: expect.objectContaining({ alias: "Default" }),
        infoHash: "abc",
        fileId: 1,
        originalTrackId: 2,
      }),
    );
  });

  it("确认翻译时未知语言码应原样保留", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nこんにちは", {
        status: 200,
      }),
    );
    vi.mocked(translateSubtitleUseCase.execute).mockResolvedValueOnce(
      "WEBVTT\n\n你好",
    );

    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl: () => "blob:mock-subtitle-url",
      },
      2,
    );

    act(() => {
      hookRef.current?.setTranslateSourceLang("xx");
    });
    // 等待 settings 查询完成，确保已选中的 AI 配置索引有效
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await hookRef.current?.handleConfirmTranslate();
    });

    expect(translateSubtitleUseCase.execute).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sourceLanguage: "xx" }),
    );
  });

  it("翻译成功后应新增 AI 轨道并自动切换到该轨道", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nこんにちは", {
        status: 200,
      }),
    );
    vi.mocked(translateSubtitleUseCase.execute).mockResolvedValueOnce(
      "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n你好",
    );

    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl: () => "blob:mock-subtitle-url",
      },
      2,
    );
    // 等待 settings 查询完成，确保已选中的 AI 配置索引有效
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      hookRef.current?.setTranslateTargetLang("zh");
    });

    await act(async () => {
      await hookRef.current?.handleConfirmTranslate();
    });

    const aiTrackId = 1_000_000;
    expect(hookRef.current?.aiSubtitleTracks[aiTrackId]).toMatchObject({
      aiTrackId,
      originalTrackId: 2,
      title: "日语字幕 · AI(zh) #1",
      language: "zh",
      url: "blob:mock-ai-url",
    });
    expect(hookRef.current?.subtitleTracks).toHaveLength(2);
    // 自动切换到 AI 轨道并关闭对话框
    expect(hookRef.selectedTrackId).toBe(aiTrackId);
    expect(hookRef.current?.translateDialogOpen).toBe(false);
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("字幕翻译完成"),
    );
  });

  it("翻译失败时应提示错误", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nこんにちは", {
        status: 200,
      }),
    );
    vi.mocked(translateSubtitleUseCase.execute).mockRejectedValueOnce(
      new Error("额度用完"),
    );

    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl: () => "blob:mock-subtitle-url",
      },
      2,
    );
    // 等待 settings 查询完成，确保已选中的 AI 配置索引有效
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await hookRef.current?.handleConfirmTranslate();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("字幕翻译失败"),
      expect.anything(),
    );
    expect(hookRef.current?.aiSubtitleTracks).toEqual({});
  });

  it("重新翻译同一原始轨道时应新增第二条 AI 轨道并保留历史", async () => {
    // 每次调用返回新的 Response，避免 Response body 被消费后再次读取抛错
    vi.mocked(globalThis.fetch).mockImplementation(() =>
      Promise.resolve(
        new Response("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nこんにちは", {
          status: 200,
        }),
      ),
    );
    vi.mocked(translateSubtitleUseCase.execute).mockResolvedValue(
      "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n你好",
    );

    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl: () => "blob:mock-subtitle-url",
      },
      2,
    );

    // 等待 settings 查询完成，确保已选中的 AI 配置索引有效
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      hookRef.current?.setTranslateTargetLang("zh");
    });

    // 第一次翻译产生第一条 AI 轨道
    await act(async () => {
      await hookRef.current?.handleConfirmTranslate();
    });
    const firstUrl = "blob:mock-ai-url";
    expect(hookRef.current?.aiSubtitleTracks[1_000_000]).toMatchObject({
      aiTrackId: 1_000_000,
      title: "日语字幕 · AI(zh) #1",
    });

    // 第二次翻译同一原始轨道：新增第二条独立轨道，历史保留
    await act(async () => {
      await hookRef.current?.handleConfirmTranslate();
    });
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(firstUrl);
    expect(hookRef.current?.aiSubtitleTracks[1_000_000]).toBeTruthy();
    expect(hookRef.current?.aiSubtitleTracks[1_000_001]).toMatchObject({
      aiTrackId: 1_000_001,
      originalTrackId: 2,
      title: "日语字幕 · AI(zh) #2",
      url: firstUrl,
    });
  });

  it("缓存列表存在同一原始轨道的多条记录时应全部展示为独立 AI 轨道", async () => {
    const record1 = {
      id: "record-1",
      info_hash: "abc",
      file_id: 1,
      original_track_id: 2,
      source_lang: "ja",
      target_lang: "zh",
      vtt_content: "",
      created_at: 1000,
      last_accessed_at: 1000,
    };
    const record2 = {
      ...record1,
      id: "record-2",
      created_at: 2000,
    };
    vi.mocked(
      subtitleTranslationRepository.listByTorrent,
    ).mockResolvedValueOnce([record1, record2]);
    vi.mocked(subtitleTranslationRepository.getById).mockResolvedValueOnce(
      cachedRecord,
    );
    vi.mocked(subtitleTranslationRepository.getById).mockResolvedValueOnce({
      ...cachedRecord,
      id: "record-2",
    });

    const hookRef = renderHook({
      getSubtitleTranslationsUseCase,
      translateSubtitleUseCase,
      getSettingsUseCase,
      infoHash: "abc",
      fileId: 1,
      metadataReady: true,
      originalSubtitleTracks,
      getSubtitleUrl: () => undefined,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(subtitleTranslationRepository.getById).toHaveBeenCalledTimes(2);
    // 同一原始轨道的多条记录各占一条 AI 轨道
    expect(hookRef.current?.aiSubtitleTracks[1_000_000]).toMatchObject({
      originalTrackId: 2,
      title: "日语字幕 · AI(zh) #1",
    });
    expect(hookRef.current?.aiSubtitleTracks[1_000_001]).toMatchObject({
      originalTrackId: 2,
      title: "日语字幕 · AI(zh) #2",
    });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("已加载 2 条"),
    );
  });

  it("缓存记录的原始轨道缺失或目标语言未知时，应使用兜底标题", async () => {
    vi.mocked(
      subtitleTranslationRepository.listByTorrent,
    ).mockResolvedValueOnce([
      {
        id: "record-5",
        info_hash: "abc",
        file_id: 1,
        original_track_id: 5,
        source_lang: "ja",
        target_lang: "xx",
        vtt_content: "",
        created_at: 1000,
        last_accessed_at: 1000,
      },
    ]);
    vi.mocked(subtitleTranslationRepository.getById).mockResolvedValueOnce({
      id: "record-5",
      info_hash: "abc",
      file_id: 1,
      original_track_id: 5,
      source_lang: "ja",
      target_lang: "xx",
      vtt_content: "WEBVTT\n\n缓存的译文",
      created_at: 1000,
      last_accessed_at: 1000,
    });

    const hookRef = renderHook({
      getSubtitleTranslationsUseCase,
      translateSubtitleUseCase,
      getSettingsUseCase,
      infoHash: "abc",
      fileId: 1,
      metadataReady: true,
      originalSubtitleTracks,
      getSubtitleUrl: () => undefined,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(hookRef.current?.aiSubtitleTracks[1_000_000]).toMatchObject({
      aiTrackId: 1_000_000,
      originalTrackId: 5,
      targetLanguage: "xx",
      title: "轨道 5 · AI(xx) #1",
    });
  });

  it("缓存加载完成前卸载组件时应丢弃结果（不创建 AI 轨道）", async () => {
    const listRecord = {
      id: "record-1",
      info_hash: "abc",
      file_id: 1,
      original_track_id: 2,
      source_lang: "ja",
      target_lang: "zh",
      vtt_content: "",
      created_at: 1000,
      last_accessed_at: 1000,
    };
    vi.mocked(
      subtitleTranslationRepository.listByTorrent,
    ).mockResolvedValueOnce([listRecord]);
    let resolveGet!: (value: SubtitleTranslationRecord | null) => void;
    vi.mocked(subtitleTranslationRepository.getById).mockReturnValue(
      new Promise((resolve) => {
        resolveGet = resolve;
      }),
    );

    const hookRef: HookRef = {
      current: null,
      selectedTrackId: null,
      setSelectedTrackId: null,
    };
    const Harness = () => {
      const [selectedTrackId, setSelectedTrackId] = useState<number | null>(
        null,
      );
      const result = useAiSubtitleTranslation({
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: true,
        originalSubtitleTracks,
        selectedTrackId,
        setSelectedTrackId,
        getSubtitleUrl: () => undefined,
      });
      hookRef.current = result;
      return null;
    };
    const { unmount } = render(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });

    unmount();
    await act(async () => {
      resolveGet(cachedRecord);
      await Promise.resolve();
    });

    // 组件已卸载，延迟返回的缓存不应再创建任何 Blob URL
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("翻译过程中应通过 onProgress 上报翻译进度", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nこんにちは", {
        status: 200,
      }),
    );
    vi.mocked(translateSubtitleUseCase.execute).mockImplementationOnce(
      (_ctx, params) => {
        params.onProgress?.(3, 5);
        return new Promise<string>(() => {});
      },
    );

    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl: () => "blob:mock-subtitle-url",
      },
      2,
    );
    // 等待 settings 查询完成，确保已选中的 AI 配置索引有效
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await hookRef.current?.handleConfirmTranslate();
    });

    expect(hookRef.current?.translateProgress).toEqual({ done: 3, total: 5 });
  });

  it("确认翻译时若原始字幕内容未就绪应提示且不调用 AI", async () => {
    const hookRef = renderHook(
      {
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: false,
        originalSubtitleTracks,
        getSubtitleUrl: () => undefined,
      },
      2,
    );
    // 等待 settings 查询完成，确保已选中的 AI 配置索引有效
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await hookRef.current?.handleConfirmTranslate();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("字幕尚未加载完成"),
    );
    expect(translateSubtitleUseCase.execute).not.toHaveBeenCalled();
  });

  it("卸载时应清理 AI 轨道 Blob URL", async () => {
    vi.mocked(
      subtitleTranslationRepository.listByTorrent,
    ).mockResolvedValueOnce([
      {
        id: "record-1",
        info_hash: "abc",
        file_id: 1,
        original_track_id: 2,
        source_lang: "ja",
        target_lang: "zh",
        vtt_content: "",
        created_at: 1000,
        last_accessed_at: 1000,
      },
    ]);
    vi.mocked(subtitleTranslationRepository.getById).mockResolvedValueOnce(
      cachedRecord,
    );

    const hookRef: HookRef = {
      current: null,
      selectedTrackId: null,
      setSelectedTrackId: null,
    };
    const Harness = () => {
      const [selectedTrackId, setSelectedTrackId] = useState<number | null>(
        null,
      );
      const result = useAiSubtitleTranslation({
        getSubtitleTranslationsUseCase,
        translateSubtitleUseCase,
        getSettingsUseCase,
        infoHash: "abc",
        fileId: 1,
        metadataReady: true,
        originalSubtitleTracks,
        selectedTrackId,
        setSelectedTrackId,
        getSubtitleUrl: () => undefined,
      });
      hookRef.current = result;
      return null;
    };

    const { unmount } = render(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(hookRef.current?.aiSubtitleTracks[1_000_000]).toBeTruthy();

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-ai-url");
  });
});
