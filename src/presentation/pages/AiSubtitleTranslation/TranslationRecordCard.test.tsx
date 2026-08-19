import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SubtitleTranslationRecord } from "@/domain/subtitle/SubtitleTranslationSchemas";
import type { TranslationRecordCardProps } from "./TranslationRecordCard";
import { TranslationRecordCard } from "./TranslationRecordCard";

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

const makeProps = (
  overrides: Partial<TranslationRecordCardProps> = {},
): TranslationRecordCardProps => ({
  record: makeRecord(),
  originalTrackTitle: "English Subtitle",
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

describe("TranslationRecordCard 翻译记录卡片组件", () => {
  it("应该渲染记录信息与操作按钮", () => {
    render(<TranslationRecordCard {...makeProps()} />);

    expect(screen.getByText("AI 翻译 · English Subtitle")).toBeInTheDocument();
    expect(screen.getByText("zh")).toBeInTheDocument();
    expect(screen.getByText(/ID: rec-uuid-1234/)).toBeInTheDocument();
    expect(screen.getByText(/原始轨道 ID: 1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
  });

  it("打开编辑对话框时应该触发 onOpenEdit，修改内容并保存", () => {
    const record = makeRecord();
    const onOpenEdit = vi.fn();
    const onEditTargetLangChange = vi.fn();
    const onEditVttContentChange = vi.fn();
    const onSaveEdit = vi.fn();
    render(
      <TranslationRecordCard
        {...makeProps({
          record,
          onOpenEdit,
          onEditTargetLangChange,
          onEditVttContentChange,
          onSaveEdit,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    expect(onOpenEdit).toHaveBeenCalledWith(record);

    fireEvent.change(screen.getByLabelText("目标语言"), {
      target: { value: "ja" },
    });
    expect(onEditTargetLangChange).toHaveBeenCalledWith("ja");

    fireEvent.change(screen.getByLabelText("字幕 VTT 内容"), {
      target: { value: "WEBVTT\nNEW" },
    });
    expect(onEditVttContentChange).toHaveBeenCalledWith("WEBVTT\nNEW");

    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(onSaveEdit).toHaveBeenCalledTimes(1);
  });

  it("点击编辑对话框中的取消按钮时不应该触发保存", () => {
    const onSaveEdit = vi.fn();
    render(<TranslationRecordCard {...makeProps({ onSaveEdit })} />);

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(onSaveEdit).not.toHaveBeenCalled();
  });

  it("saving 为 true 时保存按钮禁用并展示保存中文案", () => {
    render(<TranslationRecordCard {...makeProps({ saving: true })} />);

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled();
  });

  it("点击下载按钮时应该调用 onDownload", () => {
    const record = makeRecord();
    const onDownload = vi.fn();
    render(<TranslationRecordCard {...makeProps({ record, onDownload })} />);

    fireEvent.click(screen.getByRole("button", { name: "下载" }));

    expect(onDownload).toHaveBeenCalledWith(record);
  });

  it("打开删除确认框并点击继续时应该调用 onDelete", () => {
    const onDelete = vi.fn();
    render(<TranslationRecordCard {...makeProps({ onDelete })} />);

    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    fireEvent.click(screen.getByRole("button", { name: "继续" }));

    expect(onDelete).toHaveBeenCalledWith("rec-uuid-1234");
  });

  it("删除确认框中点击取消时不应该调用 onDelete", () => {
    const onDelete = vi.fn();
    render(<TranslationRecordCard {...makeProps({ onDelete })} />);

    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deleteLoading 为 true 时删除按钮禁用", () => {
    render(<TranslationRecordCard {...makeProps({ deleteLoading: true })} />);

    expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
  });
});
