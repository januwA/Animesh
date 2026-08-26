import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import type { SubtitleTrackInfo } from "@/domain/torrent/TorrentSchemas";
import type { TranslateFormProps } from "./TranslateForm";
import { TranslateForm } from "./TranslateForm";

const makeBranded = (value: string) => NonEmptyStringSchema.parse(value);

const makeAiConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  alias: makeBranded("OpenAI GPT-4"),
  api_endpoint: makeBranded("https://api.openai.com/v1/chat/completions"),
  api_key: makeBranded("sk-test"),
  ai_model: makeBranded("gpt-4o"),
  ...overrides,
});

const makeTrack = (
  overrides: Partial<SubtitleTrackInfo> = {},
): SubtitleTrackInfo => ({
  id: 1,
  language: "eng",
  title: "English Subtitle",
  codec: "S_TEXT/UTF8",
  ...overrides,
});

const makeProps = (
  overrides: Partial<TranslateFormProps> = {},
): TranslateFormProps => ({
  aiConfigs: [makeAiConfig()],
  originalTracks: [
    makeTrack(),
    makeTrack({ id: 2, language: "jpn", title: "Japanese Subtitle" }),
  ],
  selectedTrackId: null,
  onSelectedTrackChange: vi.fn(),
  selectedAiIndex: 0,
  onSelectedAiIndexChange: vi.fn(),
  sourceLang: "",
  onSourceLangChange: vi.fn(),
  targetLang: "",
  onTargetLangChange: vi.fn(),
  translateProgress: null,
  translateLoading: false,
  onTranslate: vi.fn(),
  ...overrides,
});

describe("TranslateForm 发起新翻译表单组件", () => {
  it("应该渲染轨道、AI 配置与语言输入框，未填写完整时翻译按钮禁用", () => {
    const onSelectedTrackChange = vi.fn();
    const onSelectedAiIndexChange = vi.fn();
    const onSourceLangChange = vi.fn();
    const onTargetLangChange = vi.fn();
    render(
      <TranslateForm
        {...makeProps({
          onSelectedTrackChange,
          onSelectedAiIndexChange,
          onSourceLangChange,
          onTargetLangChange,
        })}
      />,
    );

    expect(screen.getByText("发起新翻译")).toBeInTheDocument();
    expect(screen.getByText("English Subtitle (eng)")).toBeInTheDocument();
    expect(screen.getByText("OpenAI GPT-4 · gpt-4o")).toBeInTheDocument();

    const startBtn = screen.getByRole("button", { name: "开始翻译" });
    expect(startBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText("选择原始字幕轨道"), {
      target: { value: "1" },
    });
    expect(onSelectedTrackChange).toHaveBeenCalledWith(1);

    fireEvent.change(screen.getByLabelText("选择原始字幕轨道"), {
      target: { value: "" },
    });
    expect(onSelectedTrackChange).toHaveBeenCalledWith(null);

    fireEvent.change(screen.getByLabelText("AI 配置"), {
      target: { value: "0" },
    });
    expect(onSelectedAiIndexChange).toHaveBeenCalledWith(0);

    fireEvent.change(screen.getByLabelText("当前字幕语言"), {
      target: { value: "eng" },
    });
    expect(onSourceLangChange).toHaveBeenCalledWith("eng");

    fireEvent.change(screen.getByLabelText("目标语言"), {
      target: { value: "zh" },
    });
    expect(onTargetLangChange).toHaveBeenCalledWith("zh");
  });

  it("填写完整后翻译按钮可点击并触发 onTranslate", () => {
    const onTranslate = vi.fn();
    render(
      <TranslateForm
        {...makeProps({
          selectedTrackId: 1,
          sourceLang: "eng",
          targetLang: "zh",
          onTranslate,
        })}
      />,
    );

    const startBtn = screen.getByRole("button", { name: "开始翻译" });
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);
    expect(onTranslate).toHaveBeenCalledTimes(1);
  });

  it("翻译进行中时按钮禁用并展示加载文案", () => {
    render(<TranslateForm {...makeProps({ translateLoading: true })} />);

    expect(screen.getByRole("button", { name: "翻译中..." })).toBeDisabled();
  });

  it("存在翻译进度时应该展示进度文本", () => {
    render(
      <TranslateForm
        {...makeProps({ translateProgress: { done: 3, total: 10 } })}
      />,
    );

    expect(screen.getByText(/正在翻译中/)).toBeInTheDocument();
    expect(screen.getByText(/已完成 3 \/ 总计 10 块/)).toBeInTheDocument();
  });

  it("轨道标题为空时应该回退展示轨道编号", () => {
    render(
      <TranslateForm
        {...makeProps({
          originalTracks: [makeTrack({ title: "" })],
        })}
      />,
    );

    expect(screen.getByText("轨道 1 (eng)")).toBeInTheDocument();
  });
});
