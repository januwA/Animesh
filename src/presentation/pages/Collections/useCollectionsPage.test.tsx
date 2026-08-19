import { renderHook, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { UseCollectionsPageDeps } from "./useCollectionsPage";
import { useCollectionsPage } from "./useCollectionsPage";

const makeDeps = (
  overrides: Partial<UseCollectionsPageDeps> = {},
): UseCollectionsPageDeps => ({
  getCollectionsUseCase: {
    execute: vi.fn().mockResolvedValue([]),
  },
  ...overrides,
});

const RouterWrapper = ({ children }: { children: React.ReactNode }) => {
  const router = createMemoryRouter([{ path: "/", element: children }]);
  return <RouterProvider router={router} />;
};

const renderUseCollectionsPage = (deps: UseCollectionsPageDeps) => {
  return renderHook(() => useCollectionsPage(deps), {
    wrapper: RouterWrapper,
  });
};

describe("useCollectionsPage 收藏页面 hook", () => {
  it("应该返回收藏列表", async () => {
    const mockItems = [{ subjectId: 101, name: "测试动画", imageUrl: null }];
    const deps = makeDeps({
      getCollectionsUseCase: {
        execute: vi.fn().mockResolvedValue(mockItems),
      },
    });

    const { result } = renderUseCollectionsPage(deps);

    await waitFor(() => {
      expect(result.current.items).toEqual(mockItems);
    });
  });

  it("请求失败时应该返回空列表", async () => {
    const deps = makeDeps({
      getCollectionsUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("API error")),
      },
    });

    const { result } = renderUseCollectionsPage(deps);

    await waitFor(() => {
      expect(result.current.items).toEqual([]);
    });
  });
});
