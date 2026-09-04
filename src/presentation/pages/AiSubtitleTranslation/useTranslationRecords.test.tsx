import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DIContainer, DIContext } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SubtitleTranslationRecord } from "@/domain/subtitle/SubtitleTranslationSchemas";
import { useTranslationRecords } from "./useTranslationRecords";

const makeHash = (value: string) => NonEmptyStringSchema.parse(value);

const makeRecord = (
  overrides: Partial<SubtitleTranslationRecord> = {},
): SubtitleTranslationRecord => ({
  id: NonEmptyStringSchema.parse("rec-uuid-1234"),
  info_hash: makeHash("hash123"),
  file_id: 0,
  original_track_id: 1,
  source_lang: NonEmptyStringSchema.parse("eng"),
  target_lang: NonEmptyStringSchema.parse("zh"),
  vtt_content: "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\n你好，世界\n",
  created_at: 1000000,
  last_accessed_at: 1000000,
  ...overrides,
});

const makeParams = () => ({
  infoHash: makeHash("hash123"),
  fileId: 0,
});

const makeDI = (overrides: Record<string, unknown> = {}): DIContainer =>
  ({
    getSubtitleTranslationsUseCase: {
      execute: vi.fn().mockResolvedValue([makeRecord()]),
    },
    deleteSubtitleTranslationUseCase: {
      execute: vi.fn().mockResolvedValue(true),
    },
    saveSubtitleTranslationUseCase: {
      execute: vi.fn().mockResolvedValue(undefined),
    },
    getSubtitleTranslationByIdUseCase: {
      execute: vi.fn().mockResolvedValue(makeRecord()),
    },
    ...overrides,
  }) as unknown as DIContainer;

function createWrapper(mockDI: DIContainer) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <DIContext value={mockDI}>{children}</DIContext>;
  };
}

if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-vtt-url");
}
if (typeof URL.revokeObjectURL === "undefined") {
  URL.revokeObjectURL = vi.fn();
}

describe("useTranslationRecords 翻译记录管理 hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该从查询中加载翻译记录", async () => {
    const params = makeParams();
    const mockDI = makeDI();
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1);
      expect(result.current.records[0].id).toBe("rec-uuid-1234");
      expect(result.current.loading).toBe(false);
    });
  });

  it("当记录查询失败时，应该回退为空数组", async () => {
    const params = makeParams();
    const mockDI = makeDI({
      getSubtitleTranslationsUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("加载记录失败")),
      },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.records).toEqual([]);
    });
  });

  it("打开编辑对话框时，如果记录已有 vtt_content 则直接使用", async () => {
    const getByIdExecute = vi.fn();
    const record = makeRecord();
    const params = makeParams();
    const mockDI = makeDI({
      getSubtitleTranslationByIdUseCase: { execute: getByIdExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await act(async () => {
      await result.current.handleOpenEdit(record);
    });

    expect(result.current.editingRecord).toBe(record);
    expect(result.current.editTargetLang).toBe("zh");
    expect(result.current.editVttContent).toBe(record.vtt_content);
    expect(getByIdExecute).not.toHaveBeenCalled();
  });

  it("打开编辑对话框时，如果记录没有 vtt_content 则从 getById 异步加载", async () => {
    const fullRecord = makeRecord();
    const getByIdExecute = vi.fn().mockResolvedValue(fullRecord);
    const partialRecord = makeRecord({ vtt_content: "" });
    const params = makeParams();
    const mockDI = makeDI({
      getSubtitleTranslationByIdUseCase: { execute: getByIdExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await act(async () => {
      await result.current.handleOpenEdit(partialRecord);
    });

    expect(getByIdExecute).toHaveBeenCalledWith("rec-uuid-1234");
    expect(result.current.editVttContent).toBe(fullRecord.vtt_content);
  });

  it("打开编辑对话框时，如果 getById 返回 null，editVttContent 应为空字符串", async () => {
    const getByIdExecute = vi.fn().mockResolvedValue(null);
    const params = makeParams();
    const mockDI = makeDI({
      getSubtitleTranslationByIdUseCase: { execute: getByIdExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await act(async () => {
      await result.current.handleOpenEdit(makeRecord({ vtt_content: "" }));
    });

    expect(result.current.editVttContent).toBe("");
  });

  it("打开编辑对话框时，如果 getById 抛出错误，editVttContent 应降级为空字符串", async () => {
    const getByIdExecute = vi
      .fn()
      .mockRejectedValue(new Error("Load VTT failed"));
    const params = makeParams();
    const mockDI = makeDI({
      getSubtitleTranslationByIdUseCase: { execute: getByIdExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await act(async () => {
      await result.current.handleOpenEdit(makeRecord({ vtt_content: "" }));
    });

    expect(result.current.editVttContent).toBe("");
  });

  it("保存编辑成功后，应该调用 save use case 并提示、清空编辑状态并刷新", async () => {
    const getTranslationsExecute = vi.fn().mockResolvedValue([makeRecord()]);
    const saveExecute = vi.fn().mockResolvedValue(undefined);
    const params = makeParams();
    const mockDI = makeDI({
      getSubtitleTranslationsUseCase: { execute: getTranslationsExecute },
      saveSubtitleTranslationUseCase: { execute: saveExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleOpenEdit(makeRecord());
    });

    act(() => {
      result.current.setEditTargetLang("ja");
      result.current.setEditVttContent("WEBVTT\nNEW CONTENT");
    });

    await act(async () => {
      result.current.handleSaveEdit();
    });

    await waitFor(() => {
      expect(saveExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "rec-uuid-1234",
          target_lang: "ja",
          vtt_content: "WEBVTT\nNEW CONTENT",
        }),
      );
      expect(toast.success).toHaveBeenCalledWith("已更新字幕记录");
      expect(result.current.editingRecord).toBeNull();
      expect(getTranslationsExecute).toHaveBeenCalledTimes(2);
    });
  });

  it("保存编辑失败时，应该提示错误 Toast", async () => {
    const saveExecute = vi
      .fn()
      .mockRejectedValue(new Error("Database write failed"));
    const params = makeParams();
    const mockDI = makeDI({
      saveSubtitleTranslationUseCase: { execute: saveExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await act(async () => {
      await result.current.handleOpenEdit(makeRecord());
    });

    await act(async () => {
      result.current.handleSaveEdit();
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("保存失败: Database write failed"),
      );
    });
  });

  it("删除记录成功后，应该调用 delete use case 并提示与刷新", async () => {
    const getTranslationsExecute = vi.fn().mockResolvedValue([makeRecord()]);
    const deleteExecute = vi.fn().mockResolvedValue(true);
    const params = makeParams();
    const mockDI = makeDI({
      getSubtitleTranslationsUseCase: { execute: getTranslationsExecute },
      deleteSubtitleTranslationUseCase: { execute: deleteExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1);
    });

    await act(async () => {
      result.current.handleDelete("rec-uuid-1234");
    });

    await waitFor(() => {
      expect(deleteExecute).toHaveBeenCalledWith("rec-uuid-1234");
      expect(toast.success).toHaveBeenCalledWith("已删除翻译记录");
      expect(getTranslationsExecute).toHaveBeenCalledTimes(2);
    });
  });

  it("删除记录失败时，应该提示错误 Toast", async () => {
    const deleteExecute = vi
      .fn()
      .mockRejectedValue(new Error("Delete record failed"));
    const params = makeParams();
    const mockDI = makeDI({
      deleteSubtitleTranslationUseCase: { execute: deleteExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await act(async () => {
      result.current.handleDelete("rec-uuid-1234");
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("删除失败: Delete record failed"),
      );
    });
  });

  it("删除执行中应该设置 deleteLoading 为 true，结束后复位", async () => {
    let resolveDelete!: (value: boolean) => void;
    const deletePromise = new Promise<boolean>((resolve) => {
      resolveDelete = resolve;
    });
    const deleteExecute = vi.fn().mockImplementation(() => deletePromise);
    const params = makeParams();
    const mockDI = makeDI({
      deleteSubtitleTranslationUseCase: { execute: deleteExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    act(() => {
      result.current.handleDelete("rec-uuid-1234");
    });

    expect(result.current.deleteLoading).toBe(true);

    await act(async () => {
      resolveDelete(true);
      await deletePromise;
    });

    await waitFor(() => {
      expect(result.current.deleteLoading).toBe(false);
    });
  });

  it("下载已有内容的记录时，应该直接触发下载且不调用 getById", async () => {
    const getByIdExecute = vi.fn();
    const record = makeRecord();
    const params = makeParams();
    const mockDI = makeDI({
      getSubtitleTranslationByIdUseCase: { execute: getByIdExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await act(async () => {
      await result.current.handleDownload(record);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("字幕文件已下载");
    });
    expect(getByIdExecute).not.toHaveBeenCalled();
  });

  it("下载无内容且 getById 返回完整记录时，应该触发下载", async () => {
    const fullRecord = makeRecord();
    const getByIdExecute = vi.fn().mockResolvedValue(fullRecord);
    const params = makeParams();
    const mockDI = makeDI({
      getSubtitleTranslationByIdUseCase: { execute: getByIdExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await act(async () => {
      await result.current.handleDownload(makeRecord({ vtt_content: "" }));
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("字幕文件已下载");
    });
    expect(getByIdExecute).toHaveBeenCalledWith("rec-uuid-1234");
  });

  it("下载无内容且 getById 返回 null 时，应该提示内容为空", async () => {
    const getByIdExecute = vi.fn().mockResolvedValue(null);
    const params = makeParams();
    const mockDI = makeDI({
      getSubtitleTranslationByIdUseCase: { execute: getByIdExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await act(async () => {
      await result.current.handleDownload(makeRecord({ vtt_content: "" }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("该记录内容为空");
    });
  });

  it("下载无内容且 getById 抛出错误时，应该提示内容为空", async () => {
    const getByIdExecute = vi
      .fn()
      .mockRejectedValue(new Error("Network error"));
    const params = makeParams();
    const mockDI = makeDI({
      getSubtitleTranslationByIdUseCase: { execute: getByIdExecute },
    });
    const { result } = renderHook(() => useTranslationRecords(params), {
      wrapper: createWrapper(mockDI),
    });

    await act(async () => {
      await result.current.handleDownload(makeRecord({ vtt_content: "" }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("该记录内容为空");
    });
  });
});
