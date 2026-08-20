import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { preloadBackgroundImages } from "@/presentation/lib/preloadBackgroundImages";
import type { UseBackgroundWallpaperDeps } from "./useBackgroundWallpaper";
import { useBackgroundWallpaper } from "./useBackgroundWallpaper";

vi.mock("@/presentation/lib/preloadBackgroundImages", () => ({
  preloadBackgroundImages: vi.fn(),
}));

const mockPreload = vi.mocked(preloadBackgroundImages);

function createDeps(
  execute: UseBackgroundWallpaperDeps["getBangumiRankedSubjectsUseCase"]["execute"],
): UseBackgroundWallpaperDeps {
  return { getBangumiRankedSubjectsUseCase: { execute } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mockImage = { canvas: document.createElement("canvas"), aspect: 0.75 };

describe("useBackgroundWallpaper 背景壁纸数据加载", () => {
  it("加载成功且存在有效图片时进入 ready 状态，并去重过滤空图片地址", async () => {
    const execute = vi.fn().mockResolvedValue([
      {
        id: 1,
        name: "动画A",
        image: "https://img.example/a.jpg",
        rating: 9,
        rank: 1,
      },
      {
        id: 2,
        name: "动画B",
        image: "https://img.example/a.jpg",
        rating: 8,
        rank: 2,
      },
      { id: 3, name: "动画C", image: "", rating: 7, rank: 3 },
    ]);
    mockPreload.mockResolvedValueOnce([mockImage]);

    const deps = createDeps(execute);
    const { result } = renderHook(() => useBackgroundWallpaper(deps));

    expect(result.current.status).toBe("loading");

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(mockPreload).toHaveBeenCalledWith(["https://img.example/a.jpg"]);
    expect(result.current.images).toEqual([mockImage]);
  });

  it("预取结果为空时进入 idle 状态", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue([{ id: 1, name: "动画", image: "x.jpg" }]);
    mockPreload.mockResolvedValueOnce([]);

    const deps = createDeps(execute);
    const { result } = renderHook(() => useBackgroundWallpaper(deps));

    await waitFor(() => {
      expect(result.current.status).toBe("idle");
    });
    expect(result.current.images).toEqual([]);
  });

  it("use case 抛错时静默降级为 idle", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("network down"));

    const deps = createDeps(execute);
    const { result } = renderHook(() => useBackgroundWallpaper(deps));

    await waitFor(() => {
      expect(result.current.status).toBe("idle");
    });
  });

  it("请求挂起时卸载后不再更新状态", async () => {
    const executeDeferred = deferred<unknown[]>();
    const execute = vi.fn().mockReturnValue(executeDeferred.promise);

    const deps = createDeps(execute);
    const { result, unmount } = renderHook(() => useBackgroundWallpaper(deps));

    expect(result.current.status).toBe("loading");
    unmount();

    await act(async () => {
      executeDeferred.resolve([{ id: 1, name: "动画", image: "x.jpg" }]);
    });

    expect(result.current.status).toBe("loading");
  });

  it("预取阶段卸载后不再更新状态", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue([{ id: 1, name: "动画", image: "x.jpg" }]);
    const preloadDeferred = deferred<(typeof mockImage)[]>();
    mockPreload.mockReturnValue(preloadDeferred.promise);

    const deps = createDeps(execute);
    const { result, unmount } = renderHook(() => useBackgroundWallpaper(deps));

    await waitFor(() => {
      expect(execute).toHaveBeenCalled();
    });
    unmount();

    await act(async () => {
      preloadDeferred.resolve([mockImage]);
    });

    expect(result.current.status).toBe("loading");
  });

  it("执行抛错且已卸载时不再更新状态", async () => {
    const executeDeferred = deferred<unknown[]>();
    const execute = vi.fn().mockReturnValue(executeDeferred.promise);

    const deps = createDeps(execute);
    const { result, unmount } = renderHook(() => useBackgroundWallpaper(deps));

    expect(result.current.status).toBe("loading");
    unmount();

    await act(async () => {
      executeDeferred.reject(new Error("boom"));
    });

    expect(result.current.status).toBe("loading");
  });
});
