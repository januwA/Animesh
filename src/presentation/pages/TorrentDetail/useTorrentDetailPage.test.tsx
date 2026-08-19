import { renderHook, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ResolveTorrentUseCase } from "@/application/torrent/ResolveTorrentUseCase";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import type { UseTorrentDetailPageDeps } from "./useTorrentDetailPage";
import { useTorrentDetailPage } from "./useTorrentDetailPage";

const makeDeps = (
  overrides: Partial<UseTorrentDetailPageDeps> = {},
): UseTorrentDetailPageDeps => ({
  resolveTorrentUseCase: {
    execute: vi.fn().mockRejectedValue(new Error("not implemented")),
  } as unknown as ResolveTorrentUseCase,
  ...overrides,
});

const RouterWrapper = ({ children }: { children: React.ReactNode }) => {
  const router = createMemoryRouter([{ path: "/", element: children }]);
  return <RouterProvider router={router} />;
};

const renderUseTorrentDetailPage = (
  params: Parameters<typeof useTorrentDetailPage>[0],
  deps: UseTorrentDetailPageDeps,
) => {
  return renderHook(() => useTorrentDetailPage(params, deps), {
    wrapper: RouterWrapper,
  });
};

describe("useTorrentDetailPage 种子详情页面 hook", () => {
  it("应该调用 resolveTorrentUseCase.execute 并返回种子数据", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash123"),
      name: NonEmptyStringSchema.parse("测试种子"),
      files: [],
    };
    const deps = makeDeps({
      resolveTorrentUseCase: {
        execute: vi.fn().mockResolvedValue(mockResult),
      },
    });

    const { result } = renderUseTorrentDetailPage(
      { title: NonEmptyStringSchema.parse("测试种子") },
      deps,
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.torrent).toEqual(mockResult);
    expect(result.current.error).toBeNull();
  });

  it("请求失败时应该返回错误信息", async () => {
    const deps = makeDeps({
      resolveTorrentUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("解析失败")),
      },
    });

    const { result } = renderUseTorrentDetailPage(
      { title: NonEmptyStringSchema.parse("测试种子") },
      deps,
    );

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.loading).toBe(false);
  });

  it("应该返回 handleStartPlayback 和 handleBack 函数", async () => {
    const deps = makeDeps();

    const { result } = renderUseTorrentDetailPage(
      { title: NonEmptyStringSchema.parse("测试种子") },
      deps,
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.handleStartPlayback).toBe("function");
    expect(typeof result.current.handleBack).toBe("function");
  });
});
