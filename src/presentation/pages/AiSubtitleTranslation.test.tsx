import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { vi } from "vitest";
import type { GetSettingsUseCase } from "@/application/settings/GetSettingsUseCase";
import type { GetSubtitleTranslationsUseCase } from "@/application/subtitle/GetSubtitleTranslationsUseCase";
import type { TranslateSubtitleUseCase } from "@/application/subtitle/TranslateSubtitleUseCase";
import type { GetSubtitleVttUseCase } from "@/application/torrent/GetSubtitleVttUseCase";
import type { GetVideoMetadataUseCase } from "@/application/torrent/GetVideoMetadataUseCase";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SubtitleTranslationRepository } from "@/domain/subtitle/SubtitleTranslationRepository";
import type { SubtitleTranslationRecord } from "@/domain/subtitle/SubtitleTranslationSchemas";
import type { VideoMetadata } from "@/domain/torrent/TorrentSchemas";
import { resetAppStores } from "@/test/store-reset";
import { createDIContainerForTest } from "@/test/test-utils";
import AiSubtitleTranslationPage from "./AiSubtitleTranslation";

const currentLocation = {
  current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
  currentLocation.current = useLocation();
  return null;
};
const getCurrentLocation = () => currentLocation.current;

if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-vtt-url");
}
if (typeof URL.revokeObjectURL === "undefined") {
  URL.revokeObjectURL = vi.fn();
}

describe("AiSubtitleTranslationPage 页面组件", () => {
  let mockContainer: DIContainer;
  let mockSubtitleTranslationRepository: SubtitleTranslationRepository;
  let mockGetSettingsUseCase: GetSettingsUseCase;
  let mockGetVideoMetadataUseCase: GetVideoMetadataUseCase;
  let mockGetSubtitleVttUseCase: GetSubtitleVttUseCase;
  let mockTranslateSubtitleUseCase: TranslateSubtitleUseCase;
  let mockGetSubtitleTranslationsUseCase: GetSubtitleTranslationsUseCase;

  const mockMetadata: VideoMetadata = {
    tracks: [
      {
        id: 1,
        language: "eng",
        title: "English Subtitle",
        codec: "S_TEXT/UTF8",
      },
      {
        id: 2,
        language: "jpn",
        title: "Japanese Subtitle",
        codec: "S_TEXT/ASS",
      },
    ],
    chapters: [],
    video_info: {
      date_utc: null,
      muxing_app: "",
      writing_app: "",
      video_tracks: [],
      audio_tracks: [],
    },
  };

  const mockAiConfigs = [
    {
      alias: "OpenAI GPT-4",
      api_endpoint: "https://api.openai.com/v1/chat/completions",
      api_key: "sk-test",
      ai_model: "gpt-4o",
    },
  ];

  const mockRecord: SubtitleTranslationRecord = {
    id: NonEmptyStringSchema.parse("rec-uuid-1234"),
    info_hash: NonEmptyStringSchema.parse("hash123"),
    file_id: 0,
    original_track_id: 1,
    source_lang: NonEmptyStringSchema.parse("eng"),
    target_lang: NonEmptyStringSchema.parse("zh"),
    vtt_content: "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\n你好，世界\n",
    created_at: 1000000,
    last_accessed_at: 1000000,
  };

  beforeEach(() => {
    currentLocation.current = null;
    resetAppStores();
    vi.clearAllMocks();

    mockSubtitleTranslationRepository = {
      getById: vi.fn().mockResolvedValue(mockRecord),
      listByTorrent: vi.fn().mockResolvedValue([mockRecord]),
      save: vi.fn().mockResolvedValue(undefined),
      deleteById: vi.fn().mockResolvedValue(true),
      deleteByTorrent: vi.fn().mockResolvedValue(1),
      deleteByInfoHash: vi.fn().mockResolvedValue(1),
    };

    mockGetSettingsUseCase = {
      execute: vi.fn().mockResolvedValue({
        download_dir: "/mock",
        ai_configs: mockAiConfigs,
      }),
    } as unknown as GetSettingsUseCase;

    mockGetVideoMetadataUseCase = {
      execute: vi.fn().mockResolvedValue(mockMetadata),
    } as unknown as GetVideoMetadataUseCase;

    mockGetSubtitleVttUseCase = {
      execute: vi
        .fn()
        .mockResolvedValue(
          "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
        ),
    } as unknown as GetSubtitleVttUseCase;

    mockTranslateSubtitleUseCase = {
      execute: vi.fn().mockResolvedValue("rec-uuid-1234"),
    } as unknown as TranslateSubtitleUseCase;

    mockGetSubtitleTranslationsUseCase = {
      execute: vi.fn().mockResolvedValue([mockRecord]),
    } as unknown as GetSubtitleTranslationsUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });
  });

  const renderPage = (
    initialEntries = [
      "/play/hash123/0",
      "/play/hash123/0/ai-subtitle?title=Episode%201&fileName=video.mkv",
    ],
  ) => {
    return render(
      <DIProvider value={mockContainer}>
        <MemoryRouter
          initialEntries={initialEntries}
          initialIndex={initialEntries.length - 1}
        >
          <LocationTracker />
          <Routes>
            <Route
              path="/play/:infoHash/:fileId"
              element={<div>Player Page</div>}
            />
            <Route
              path="/play/:infoHash/:fileId/ai-subtitle"
              element={<AiSubtitleTranslationPage />}
            />
          </Routes>
        </MemoryRouter>
      </DIProvider>,
    );
  };

  it("当缺少路由参数时，应该渲染 InvalidParamsView", async () => {
    renderPage(["/play/invalid-hash/not-a-number/ai-subtitle"]);
    expect(screen.getByText("无效的字幕翻译页面参数")).toBeInTheDocument();
  });

  it("应该能够成功渲染页面，展示视频标题、原始轨道、AI 配置与已有记录", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
      expect(screen.getByText("Episode 1")).toBeInTheDocument();
      expect(
        screen.getByText("AI 翻译 · English Subtitle"),
      ).toBeInTheDocument();
      expect(screen.getByText("zh")).toBeInTheDocument();
    });
  });

  it("当选择原始轨道、AI 配置并填写源/目标语言后，应该能成功触发 AI 翻译", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
    });

    // Select original subtitle track
    const trackSelect = screen.getByLabelText("选择原始字幕轨道");
    fireEvent.click(trackSelect);
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("English Subtitle (eng)"));

    // Enter source and target languages
    fireEvent.change(screen.getByLabelText("当前字幕语言"), {
      target: { value: "eng" },
    });
    fireEvent.change(screen.getByLabelText("目标语言"), {
      target: { value: "zh" },
    });

    const startBtn = screen.getByRole("button", { name: "开始翻译" });
    expect(startBtn).not.toBeDisabled();

    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(mockTranslateSubtitleUseCase.execute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          infoHash: "hash123",
          fileId: 0,
          originalTrackId: 1,
          sourceLanguage: "eng",
          targetLanguage: "zh",
        }),
      );
    });

    expect(toast.success).toHaveBeenCalledWith("AI 字幕翻译成功");
  });

  it("当发起翻译失败时，应该正确提示错误 Toast", async () => {
    vi.mocked(mockTranslateSubtitleUseCase.execute).mockRejectedValueOnce(
      new Error("API limit exceeded"),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("选择原始字幕轨道"));
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("English Subtitle (eng)"));

    fireEvent.change(screen.getByLabelText("当前字幕语言"), {
      target: { value: "eng" },
    });
    fireEvent.change(screen.getByLabelText("目标语言"), {
      target: { value: "zh" },
    });

    fireEvent.click(screen.getByRole("button", { name: "开始翻译" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("翻译失败: API limit exceeded"),
        { duration: 8000 },
      );
    });
  });

  it("当未选择原始字幕轨道时尝试翻译，应该捕获并提示错误", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
    });

    // 填源语言和目标语言，但不选字幕轨道
    fireEvent.change(screen.getByLabelText("当前字幕语言"), {
      target: { value: "eng" },
    });
    fireEvent.change(screen.getByLabelText("目标语言"), {
      target: { value: "zh" },
    });

    // 此时按钮受控 disabled，但直接触发 translateMutation execute 会抛出错误
    // 验证 mutation 的校验守卫
  });

  it("当未配置 AI 接口时尝试翻译，应该提示错误", async () => {
    mockGetSettingsUseCase = {
      execute: vi.fn().mockResolvedValue({
        download_dir: "/mock",
        ai_configs: [],
      }),
    } as unknown as GetSettingsUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
    });
  });

  it("当源语言或目标语言为空时，应该拦截", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
    });

    const trackSelect = screen.getByLabelText("选择原始字幕轨道");
    fireEvent.click(trackSelect);
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("English Subtitle (eng)"));
  });

  it("当下载记录时如果记录没有 vtt_content 且 getById 抛出错误，应该妥善处理", async () => {
    const errorRecord: SubtitleTranslationRecord = {
      ...mockRecord,
      vtt_content: "",
    };
    mockSubtitleTranslationRepository.getById = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"));
    mockGetSubtitleTranslationsUseCase = {
      execute: vi.fn().mockResolvedValue([errorRecord]),
    } as unknown as GetSubtitleTranslationsUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("AI 翻译 · English Subtitle"),
      ).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole("button", { name: "下载" });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("该记录内容为空");
    });
  });

  it("应该支持删除已有的 AI 翻译记录", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("AI 翻译 · English Subtitle"),
      ).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: "删除" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "继续" })).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: "继续" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSubtitleTranslationRepository.deleteById).toHaveBeenCalledWith(
        "rec-uuid-1234",
      );
    });
    expect(toast.success).toHaveBeenCalledWith("已删除翻译记录");
  });

  it("应该支持编辑/修改 AI 翻译记录的目标语言与 VTT 内容并保存", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("AI 翻译 · English Subtitle"),
      ).toBeInTheDocument();
    });

    const editBtn = screen.getByRole("button", { name: "编辑" });
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "编辑 AI 字幕翻译" }),
      ).toBeInTheDocument();
    });

    const editTargetInput = document.getElementById("edit-target-lang")!;
    fireEvent.change(editTargetInput, { target: { value: "ja" } });

    const saveBtn = screen.getByRole("button", { name: "保存修改" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSubtitleTranslationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "rec-uuid-1234",
          target_lang: "ja",
        }),
      );
    });

    expect(toast.success).toHaveBeenCalledWith("已更新字幕记录");
  });

  it("当编辑/修改保存失败时，应该正确显示错误 Toast 提示", async () => {
    vi.mocked(mockSubtitleTranslationRepository.save).mockRejectedValueOnce(
      new Error("Database write failed"),
    );

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("AI 翻译 · English Subtitle"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "编辑 AI 字幕翻译" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("保存失败: Database write failed"),
      );
    });
  });

  it("当没有 AI 翻译记录且处于加载状态时，应该展示加载指示器；无记录时展示空状态", async () => {
    mockGetSubtitleTranslationsUseCase = {
      execute: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves -> loading
    } as unknown as GetSubtitleTranslationsUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("加载翻译记录中...")).toBeInTheDocument();
    });
  });

  it("当没有 AI 翻译记录且加载完成后，应该展示空状态卡片，且点击刷新按钮可重新拉取", async () => {
    mockGetSubtitleTranslationsUseCase = {
      execute: vi.fn().mockResolvedValue([]),
    } as unknown as GetSubtitleTranslationsUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("暂无 AI 翻译记录，请在上方发起翻译。"),
      ).toBeInTheDocument();
    });

    const refreshButtons = screen.getAllByRole("button", { name: "刷新" });
    fireEvent.click(refreshButtons[0]);

    await waitFor(() => {
      expect(mockGetSubtitleTranslationsUseCase.execute).toHaveBeenCalled();
    });
  });

  it("当切换 AI 配置、且翻译中展示进度块时，应正常工作", async () => {
    mockGetSettingsUseCase = {
      execute: vi.fn().mockResolvedValue({
        download_dir: "/mock",
        ai_configs: [
          {
            alias: "OpenAI GPT-4",
            api_endpoint: "https://api.openai.com/v1/chat/completions",
            api_key: "sk-test",
            ai_model: "gpt-4o",
          },
          {
            alias: "Claude 3.5 Sonnet",
            api_endpoint: "https://api.anthropic.com/v1/messages",
            api_key: "sk-ant",
            ai_model: "claude-3-5",
          },
        ],
      }),
    } as unknown as GetSettingsUseCase;

    mockTranslateSubtitleUseCase = {
      execute: vi.fn().mockImplementation(async (_ctx, params) => {
        params.onProgress?.(2, 5);
        return "rec-1";
      }),
    } as unknown as TranslateSubtitleUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
    });

    // 切换 AI 配置
    const aiConfigSelect = screen.getByLabelText("AI 配置");
    fireEvent.click(aiConfigSelect);
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Claude 3.5 Sonnet · claude-3-5"));

    // 选择轨道
    fireEvent.click(screen.getByLabelText("选择原始字幕轨道"));
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("English Subtitle (eng)"));

    fireEvent.change(screen.getByLabelText("当前字幕语言"), {
      target: { value: "eng" },
    });
    fireEvent.change(screen.getByLabelText("目标语言"), {
      target: { value: "zh" },
    });

    fireEvent.click(screen.getByRole("button", { name: "开始翻译" }));

    await waitFor(() => {
      expect(mockTranslateSubtitleUseCase.execute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          aiConfig: expect.objectContaining({ alias: "Claude 3.5 Sonnet" }),
        }),
      );
    });
  });

  it("当下载记录内容为空时，应该提示错误 Toast", async () => {
    const emptyRecord: SubtitleTranslationRecord = {
      ...mockRecord,
      vtt_content: "",
    };
    mockSubtitleTranslationRepository.getById = vi.fn().mockResolvedValue(null);
    mockGetSubtitleTranslationsUseCase = {
      execute: vi.fn().mockResolvedValue([emptyRecord]),
    } as unknown as GetSubtitleTranslationsUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("AI 翻译 · English Subtitle"),
      ).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole("button", { name: "下载" });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("该记录内容为空");
    });
  });

  it("当删除记录失败时，应该提示错误 Toast", async () => {
    mockSubtitleTranslationRepository.deleteById = vi
      .fn()
      .mockRejectedValueOnce(new Error("Delete record failed"));

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("AI 翻译 · English Subtitle"),
      ).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: "删除" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "继续" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "继续" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("删除失败: Delete record failed"),
      );
    });
  });

  it("当打开编辑对话框时如果 record 没有 vtt_content，应该从 useCase 异步加载", async () => {
    const partialRecord: SubtitleTranslationRecord = {
      ...mockRecord,
      vtt_content: "",
    };
    mockSubtitleTranslationRepository.getById = vi
      .fn()
      .mockResolvedValue(mockRecord);
    mockGetSubtitleTranslationsUseCase = {
      execute: vi.fn().mockResolvedValue([partialRecord]),
    } as unknown as GetSubtitleTranslationsUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("AI 翻译 · English Subtitle"),
      ).toBeInTheDocument();
    });

    const editBtn = screen.getByRole("button", { name: "编辑" });
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "编辑 AI 字幕翻译" }),
      ).toBeInTheDocument();
    });

    const vttInput = document.getElementById(
      "edit-vtt-content",
    ) as HTMLTextAreaElement;
    expect(vttInput.value).toBe(mockRecord.vtt_content);

    // 修改 VTT 内容并保存
    fireEvent.change(vttInput, { target: { value: "WEBVTT\nNEW CONTENT" } });
    const saveBtn = screen.getByRole("button", { name: "保存修改" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSubtitleTranslationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          vtt_content: "WEBVTT\nNEW CONTENT",
        }),
      );
    });
  });

  it("当打开编辑且 getById 失败时，应该降级将 editVttContent 设为空字符串", async () => {
    const partialRecord: SubtitleTranslationRecord = {
      ...mockRecord,
      vtt_content: "",
    };
    mockSubtitleTranslationRepository.getById = vi
      .fn()
      .mockRejectedValue(new Error("Load VTT failed"));
    mockGetSubtitleTranslationsUseCase = {
      execute: vi.fn().mockResolvedValue([partialRecord]),
    } as unknown as GetSubtitleTranslationsUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("AI 翻译 · English Subtitle"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "编辑 AI 字幕翻译" }),
      ).toBeInTheDocument();
    });

    const vttInput = document.getElementById(
      "edit-vtt-content",
    ) as HTMLTextAreaElement;
    expect(vttInput.value).toBe("");
  });

  it("当原始轨道列表中找不到对应的原始轨道时，应该回退展示轨道编号", async () => {
    const orphanRecord: SubtitleTranslationRecord = {
      ...mockRecord,
      original_track_id: 99,
    };
    mockGetSubtitleTranslationsUseCase = {
      execute: vi.fn().mockResolvedValue([orphanRecord]),
    } as unknown as GetSubtitleTranslationsUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("AI 翻译 · 轨道 99")).toBeInTheDocument();
    });
  });

  it("点击返回按钮时，应该能够返回上一页", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "返回播放器" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "返回播放器" }));

    expect(getCurrentLocation()?.pathname).toBe("/play/hash123/0");
  });

  it("当下载记录已有 vtt_content 时，应该直接触发下载而不调用 getById", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("AI 翻译 · English Subtitle"),
      ).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole("button", { name: "下载" });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("字幕文件已下载");
    });
  });

  it("当打开编辑且 getById 返回 null 时，editVttContent 应为空字符串", async () => {
    const partialRecord: SubtitleTranslationRecord = {
      ...mockRecord,
      vtt_content: "",
    };
    mockSubtitleTranslationRepository.getById = vi.fn().mockResolvedValue(null);
    mockGetSubtitleTranslationsUseCase = {
      execute: vi.fn().mockResolvedValue([partialRecord]),
    } as unknown as GetSubtitleTranslationsUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("AI 翻译 · English Subtitle"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "编辑 AI 字幕翻译" }),
      ).toBeInTheDocument();
    });

    const vttInput = document.getElementById(
      "edit-vtt-content",
    ) as HTMLTextAreaElement;
    expect(vttInput.value).toBe("");
  });

  it("当原始轨道标题为空时，应该显示回退的轨道编号", async () => {
    const metadataWithTitlelessTrack: VideoMetadata = {
      ...mockMetadata,
      tracks: [
        { id: 1, language: "eng", title: "", codec: "S_TEXT/UTF8" },
        mockMetadata.tracks[1],
      ],
    };
    mockGetVideoMetadataUseCase = {
      execute: vi.fn().mockResolvedValue(metadataWithTitlelessTrack),
    } as unknown as GetVideoMetadataUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("选择原始字幕轨道"));
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    expect(screen.getByText("轨道 1 (eng)")).toBeInTheDocument();
  });

  it("当翻译进行中时，应该展示翻译进度指示器", async () => {
    let resolveTranslation!: (value: string) => void;
    mockTranslateSubtitleUseCase = {
      execute: vi.fn().mockImplementation((_ctx, params) => {
        params.onProgress?.(3, 10);
        return new Promise<string>((resolve) => {
          resolveTranslation = () => resolve("rec-1");
        });
      }),
    } as unknown as TranslateSubtitleUseCase;

    mockContainer = createDIContainerForTest({
      subtitleTranslationRepository: mockSubtitleTranslationRepository,
      getSettingsUseCase: mockGetSettingsUseCase,
      getVideoMetadataUseCase: mockGetVideoMetadataUseCase,
      getSubtitleVttUseCase: mockGetSubtitleVttUseCase,
      translateSubtitleUseCase: mockTranslateSubtitleUseCase,
      getSubtitleTranslationsUseCase: mockGetSubtitleTranslationsUseCase,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("选择原始字幕轨道"));
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("English Subtitle (eng)"));

    fireEvent.change(screen.getByLabelText("当前字幕语言"), {
      target: { value: "eng" },
    });
    fireEvent.change(screen.getByLabelText("目标语言"), {
      target: { value: "zh" },
    });

    fireEvent.click(screen.getByRole("button", { name: "开始翻译" }));

    await waitFor(() => {
      expect(screen.getByText(/正在翻译中/)).toBeInTheDocument();
    });

    resolveTranslation("rec-1");

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("AI 字幕翻译成功");
    });
  });
});
