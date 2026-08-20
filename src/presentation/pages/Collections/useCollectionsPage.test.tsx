import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/presentation/store/collectionsStore";
import { resetAppStores } from "@/test/store-reset";
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

const lastNavigation: {
  current: { pathname: string; state: unknown } | null;
} = { current: null };
const LocationTracker = () => {
  lastNavigation.current = useLocation();
  return null;
};

const RouterWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <LocationTracker />
      {children}
    </MemoryRouter>
  );
};

const renderUseCollectionsPage = (deps: UseCollectionsPageDeps) => {
  return renderHook(() => useCollectionsPage(deps), {
    wrapper: RouterWrapper,
  });
};

describe("useCollectionsPage 收藏页面 hook", () => {
  beforeEach(() => {
    resetAppStores();
  });

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

  it("store 已有缓存时应该立即返回缓存，并后台刷新覆盖 store", async () => {
    const cachedItem = {
      subjectId: 101,
      name: "缓存动画",
      imageUrl: null,
      addedAt: 1,
    };
    const freshItems = [{ subjectId: 102, name: "新动画", imageUrl: null }];
    useCollectionsStore.getState().setItems([cachedItem]);
    const deps = makeDeps({
      getCollectionsUseCase: {
        execute: vi.fn().mockResolvedValue(freshItems),
      },
    });

    const { result } = renderUseCollectionsPage(deps);

    expect(result.current.items).toEqual([cachedItem]);

    await waitFor(() => {
      expect(result.current.items).toEqual(freshItems);
    });
  });

  it("handleItemClick 应该导航到 subject 页面并传递名称与封面", async () => {
    const deps = makeDeps();
    const { result } = renderUseCollectionsPage(deps);

    await waitFor(() => {
      expect(result.current.items).toEqual([]);
    });

    act(() => {
      result.current.handleItemClick({
        subjectId: 101,
        name: "测试动画",
        imageUrl: null,
      });
    });

    expect(lastNavigation.current?.pathname).toBe("/subject/101");
    expect(lastNavigation.current?.state).toEqual({
      name: "测试动画",
      imageUrl: null,
    });
  });
});
