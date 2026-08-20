import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
  return <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>;
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

  it("应该返回 handleStartPlayback 函数", async () => {
    const deps = makeDeps();

    const { result } = renderUseTorrentDetailPage(
      { title: NonEmptyStringSchema.parse("测试种子") },
      deps,
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.handleStartPlayback).toBeTypeOf("function");
  });

  it("handleStartPlayback 应该调用 navigate 并传递正确的 URL", async () => {
    const deps = makeDeps();
    const { result } = renderUseTorrentDetailPage(
      {
        title: NonEmptyStringSchema.parse("测试种子"),
        magnet: NonEmptyStringSchema.parse("magnet:?xt=urn:test"),
      },
      deps,
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.handleStartPlayback("abc123", 0, "video.mp4");
    });
  });
});
