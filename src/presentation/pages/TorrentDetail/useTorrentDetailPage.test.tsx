import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolveTorrentUseCase } from "@/application/torrent/ResolveTorrentUseCase";
import type { UpdateOnlyFilesUseCase } from "@/application/torrent/UpdateOnlyFilesUseCase";
import { type DIContainer, DIContext } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import { useTorrentDetailPage } from "./useTorrentDetailPage";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockDIContainer = {
  resolveTorrentUseCase: {
    execute: vi.fn().mockRejectedValue(new Error("not implemented")),
  } as unknown as ResolveTorrentUseCase,
  updateOnlyFilesUseCase: {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as UpdateOnlyFilesUseCase,
} as unknown as DIContainer;

const lastNavigation: {
  current: { pathname: string; search: string } | null;
} = { current: null };

const LocationTracker = () => {
  lastNavigation.current = useLocation();
  return null;
};

const RouterWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <DIContext value={mockDIContainer}>
      <MemoryRouter initialEntries={["/"]}>
        <LocationTracker />
        {children}
      </MemoryRouter>
    </DIContext>
  );
};

const renderUseTorrentDetailPage = (
  params: Parameters<typeof useTorrentDetailPage>[0],
) => {
  return renderHook(() => useTorrentDetailPage(params), {
    wrapper: RouterWrapper,
  });
};

describe("useTorrentDetailPage 种子详情页面 hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该调用 resolveTorrentUseCase.execute 并返回种子数据", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash123"),
      files: [
        {
          id: 0,
          name: NonEmptyStringSchema.parse("a.mp4"),
          len: 100,
          included: true,
        },
      ],
    };
    vi.mocked(
      mockDIContainer.resolveTorrentUseCase.execute,
    ).mockResolvedValueOnce(mockResult);

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.torrent).toEqual(mockResult);
    expect(result.current.error).toBeNull();
  });

  it("请求失败时应该返回错误信息", async () => {
    vi.mocked(
      mockDIContainer.resolveTorrentUseCase.execute,
    ).mockRejectedValueOnce(new Error("解析失败"));

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.loading).toBe(false);
  });

  it("应该返回 handleStartPlayback 函数", async () => {
    vi.mocked(
      mockDIContainer.resolveTorrentUseCase.execute,
    ).mockResolvedValueOnce({
      info_hash: NonEmptyStringSchema.parse("hash123"),
      files: [],
    });

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.handleStartPlayback).toBeTypeOf("function");
  });

  it("应该根据种子文件的 included 状态初始化 selectedIds", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash123"),
      files: [
        {
          id: 0,
          name: NonEmptyStringSchema.parse("a.mp4"),
          len: 100,
          included: true,
        },
        {
          id: 1,
          name: NonEmptyStringSchema.parse("b.mp4"),
          len: 200,
          included: false,
        },
      ],
    };
    vi.mocked(
      mockDIContainer.resolveTorrentUseCase.execute,
    ).mockResolvedValueOnce(mockResult);

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.selectedIds).toEqual(new Set([0]));
    });
  });

  it("toggleFile 应该正确切换文件选择状态", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash123"),
      files: [
        {
          id: 0,
          name: NonEmptyStringSchema.parse("a.mp4"),
          len: 100,
          included: true,
        },
      ],
    };
    vi.mocked(
      mockDIContainer.resolveTorrentUseCase.execute,
    ).mockResolvedValueOnce(mockResult);

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.selectedIds).toEqual(new Set([0]));
    });

    act(() => {
      result.current.toggleFile(0);
    });
    expect(result.current.selectedIds.has(0)).toBe(false);

    act(() => {
      result.current.toggleFile(0);
    });
    expect(result.current.selectedIds.has(0)).toBe(true);
  });

  it("confirmSelection 应该调用 updateOnlyFilesUseCase.execute", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash123"),
      files: [
        {
          id: 0,
          name: NonEmptyStringSchema.parse("a.mp4"),
          len: 100,
          included: true,
        },
      ],
    };
    vi.mocked(
      mockDIContainer.resolveTorrentUseCase.execute,
    ).mockResolvedValueOnce(mockResult);

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.selectedIds).toEqual(new Set([0]));
    });

    await act(async () => {
      await result.current.confirmSelection();
    });

    expect(mockDIContainer.updateOnlyFilesUseCase.execute).toHaveBeenCalledWith(
      "hash123",
      [0],
    );
    expect(toast.success).toHaveBeenCalled();
    expect(result.current.confirming).toBe(false);
  });

  it("confirmSelection 失败时应该 toast 错误并恢复 confirming", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash123"),
      files: [
        {
          id: 0,
          name: NonEmptyStringSchema.parse("a.mp4"),
          len: 100,
          included: true,
        },
      ],
    };
    vi.mocked(
      mockDIContainer.resolveTorrentUseCase.execute,
    ).mockResolvedValueOnce(mockResult);
    vi.mocked(
      mockDIContainer.updateOnlyFilesUseCase.execute,
    ).mockRejectedValueOnce(new Error("更新失败"));

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.selectedIds).toEqual(new Set([0]));
    });

    await act(async () => {
      await result.current.confirmSelection();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("更新失败"),
    );
    expect(result.current.confirming).toBe(false);
  });

  it("toggleAll 在未全选时应选中所有文件", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash123"),
      files: [
        {
          id: 0,
          name: NonEmptyStringSchema.parse("a.mp4"),
          len: 100,
          included: false,
        },
        {
          id: 1,
          name: NonEmptyStringSchema.parse("b.mp4"),
          len: 200,
          included: false,
        },
      ],
    };
    vi.mocked(
      mockDIContainer.resolveTorrentUseCase.execute,
    ).mockResolvedValueOnce(mockResult);

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.toggleAll(mockResult.files);
    });

    expect(result.current.selectedIds).toEqual(new Set([0, 1]));
  });

  it("toggleAll 在已全选时应清空选择", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash123"),
      files: [
        {
          id: 0,
          name: NonEmptyStringSchema.parse("a.mp4"),
          len: 100,
          included: true,
        },
        {
          id: 1,
          name: NonEmptyStringSchema.parse("b.mp4"),
          len: 200,
          included: true,
        },
      ],
    };
    vi.mocked(
      mockDIContainer.resolveTorrentUseCase.execute,
    ).mockResolvedValueOnce(mockResult);

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.selectedIds).toEqual(new Set([0, 1]));
    });

    act(() => {
      result.current.toggleAll(mockResult.files);
    });

    expect(result.current.selectedIds).toEqual(new Set());
  });

  it("handleStartPlayback 应跳转到播放路由并携带文件名参数", async () => {
    vi.mocked(
      mockDIContainer.resolveTorrentUseCase.execute,
    ).mockResolvedValueOnce({
      info_hash: NonEmptyStringSchema.parse("hash123"),
      files: [],
    });

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.handleStartPlayback("hash123", 0, "video.mp4");
    });

    expect(lastNavigation.current?.pathname).toBe("/play/hash123/0");
    expect(lastNavigation.current?.search).toBe("?fileName=video.mp4");
  });

  it("torrent 为 null 时 confirmSelection 应直接返回不执行任何操作", async () => {
    vi.mocked(
      mockDIContainer.resolveTorrentUseCase.execute,
    ).mockRejectedValueOnce(new Error("加载失败"));

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    await act(async () => {
      await result.current.confirmSelection();
    });

    expect(
      mockDIContainer.updateOnlyFilesUseCase.execute,
    ).not.toHaveBeenCalled();
  });
});
