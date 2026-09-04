import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ResolveTorrentUseCase } from "@/application/torrent/ResolveTorrentUseCase";
import type { UpdateOnlyFilesUseCase } from "@/application/torrent/UpdateOnlyFilesUseCase";
import { type DIContainer, DIContext } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import { useTorrentDetailPage } from "./useTorrentDetailPage";

const mockDIContainer = {
  resolveTorrentUseCase: {
    execute: vi.fn().mockRejectedValue(new Error("not implemented")),
  } as unknown as ResolveTorrentUseCase,
  updateOnlyFilesUseCase: {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as UpdateOnlyFilesUseCase,
} as unknown as DIContainer;

const RouterWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <DIContext value={mockDIContainer}>
      <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>
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
    vi.mocked(mockDIContainer.resolveTorrentUseCase.execute).mockResolvedValue(
      mockResult,
    );

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.torrent).toEqual(mockResult);
    expect(result.current.error).toBeNull();
  });

  it("请求失败时应该返回错误信息", async () => {
    vi.mocked(mockDIContainer.resolveTorrentUseCase.execute).mockRejectedValue(
      new Error("解析失败"),
    );

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.loading).toBe(false);
  });

  it("应该返回 handleStartPlayback 函数", async () => {
    vi.mocked(mockDIContainer.resolveTorrentUseCase.execute).mockResolvedValue({
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
    vi.mocked(mockDIContainer.resolveTorrentUseCase.execute).mockResolvedValue(
      mockResult,
    );

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.initialized).toBe(true);
    expect(result.current.selectedIds).toEqual(new Set([0]));
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
    vi.mocked(mockDIContainer.resolveTorrentUseCase.execute).mockResolvedValue(
      mockResult,
    );

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
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
    vi.mocked(mockDIContainer.resolveTorrentUseCase.execute).mockResolvedValue(
      mockResult,
    );

    const { result } = renderUseTorrentDetailPage({});

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    await act(async () => {
      await result.current.confirmSelection();
    });

    expect(mockDIContainer.updateOnlyFilesUseCase.execute).toHaveBeenCalledWith(
      "hash123",
      [0],
    );
  });
});
