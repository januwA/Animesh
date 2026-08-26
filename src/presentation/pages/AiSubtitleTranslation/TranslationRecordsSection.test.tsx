import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SubtitleTranslationRecord } from "@/domain/subtitle/SubtitleTranslationSchemas";
import type { SubtitleTrackInfo } from "@/domain/torrent/TorrentSchemas";
import type { TranslationRecordsSectionProps } from "./TranslationRecordsSection";
import { TranslationRecordsSection } from "./TranslationRecordsSection";

const makeRecord = (
  overrides: Partial<SubtitleTranslationRecord> = {},
): SubtitleTranslationRecord => ({
  id: NonEmptyStringSchema.parse("rec-uuid-1234"),
  info_hash: NonEmptyStringSchema.parse("hash123"),
  file_id: 0,
  original_track_id: 1,
  source_lang: NonEmptyStringSchema.parse("eng"),
  target_lang: NonEmptyStringSchema.parse("zh"),
  vtt_content: "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\n你好，世界\n",
  created_at: 1000000,
  last_accessed_at: 1000000,
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
  overrides: Partial<TranslationRecordsSectionProps> = {},
): TranslationRecordsSectionProps => ({
  records: [makeRecord()],
  loading: false,
  originalTracks: [makeTrack()],
  onRefresh: vi.fn(),
  editTargetLang: "zh",
  onEditTargetLangChange: vi.fn(),
  editVttContent: "WEBVTT",
  onEditVttContentChange: vi.fn(),
  saving: false,
  deleteLoading: false,
  onOpenEdit: vi.fn(),
  onSaveEdit: vi.fn(),
  onDownload: vi.fn(),
  onDelete: vi.fn(),
  ...overrides,
});

describe("TranslationRecordsSection 翻译记录列表组件", () => {
  it("加载中且无记录时应该展示加载指示器", () => {
    render(
      <TranslationRecordsSection
        {...makeProps({ records: [], loading: true })}
      />,
    );

    expect(screen.getByText("加载翻译记录中...")).toBeInTheDocument();
  });

  it("加载完成且无记录时应该展示空状态", () => {
    render(<TranslationRecordsSection {...makeProps({ records: [] })} />);

    expect(
      screen.getByText("暂无 AI 翻译记录，请在上方发起翻译。"),
    ).toBeInTheDocument();
  });

  it("有记录时应该渲染卡片列表并解析原始轨道标题", () => {
    const onOpenEdit = vi.fn();
    render(
      <TranslationRecordsSection
        {...makeProps({
          records: [makeRecord()],
          onOpenEdit,
        })}
      />,
    );

    expect(screen.getByText("AI 翻译 · English Subtitle")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    expect(onOpenEdit).toHaveBeenCalledWith(makeRecord());
  });

  it("加载中但已有记录时应该展示列表", () => {
    render(
      <TranslationRecordsSection
        {...makeProps({ records: [makeRecord()], loading: true })}
      />,
    );

    expect(screen.getByText("AI 翻译 · English Subtitle")).toBeInTheDocument();
    expect(screen.queryByText("加载翻译记录中...")).not.toBeInTheDocument();
  });

  it("记录对应轨道不存在时应该回退展示轨道编号", () => {
    render(
      <TranslationRecordsSection
        {...makeProps({
          records: [makeRecord({ original_track_id: 99 })],
          originalTracks: [makeTrack()],
        })}
      />,
    );

    expect(screen.getByText("AI 翻译 · 轨道 99")).toBeInTheDocument();
  });

  it("记录对应轨道标题为空时应该回退展示轨道编号", () => {
    render(
      <TranslationRecordsSection
        {...makeProps({
          records: [makeRecord()],
          originalTracks: [makeTrack({ title: "" })],
        })}
      />,
    );

    expect(screen.getByText("AI 翻译 · 轨道 1")).toBeInTheDocument();
  });

  it("点击刷新按钮时应该调用 onRefresh", () => {
    const onRefresh = vi.fn();
    render(<TranslationRecordsSection {...makeProps({ onRefresh })} />);

    fireEvent.click(screen.getByRole("button", { name: "刷新" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
