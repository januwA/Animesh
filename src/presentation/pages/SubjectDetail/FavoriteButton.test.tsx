import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AddFavoriteUseCase } from "@/application/collection/AddFavoriteUseCase";
import type { GetFavoriteStatusUseCase } from "@/application/collection/GetFavoriteStatusUseCase";
import type { RemoveFavoriteUseCase } from "@/application/collection/RemoveFavoriteUseCase";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import { useCollectionsStore } from "@/presentation/store/collectionsStore";
import { resetAppStores } from "@/test/store-reset";
import { FavoriteButton } from "./FavoriteButton";

type FavoriteDeps = {
  getFavoriteStatusUseCase: Pick<GetFavoriteStatusUseCase, "execute">;
  addFavoriteUseCase: Pick<AddFavoriteUseCase, "execute">;
  removeFavoriteUseCase: Pick<RemoveFavoriteUseCase, "execute">;
};

function createDeps(overrides: Partial<FavoriteDeps> = {}): FavoriteDeps {
  return {
    getFavoriteStatusUseCase: { execute: vi.fn().mockResolvedValue(false) },
    addFavoriteUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
    removeFavoriteUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  };
}

function renderButton(deps: FavoriteDeps = createDeps()) {
  return render(
    <FavoriteButton
      subject={mockSubject}
      getFavoriteStatusUseCase={deps.getFavoriteStatusUseCase}
      addFavoriteUseCase={deps.addFavoriteUseCase}
      removeFavoriteUseCase={deps.removeFavoriteUseCase}
    />,
  );
}

const mockSubject: BangumiSubject = {
  id: 101,
  name: "中文名称",
  image: "https://example.com/image.jpg",
  rating: 8.5,
  platform: "TV",
  date: "2026-07-01",
  summary: "剧情简介",
};

describe("FavoriteButton 收藏按钮", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAppStores();
  });

  it("初始状态应该显示'收藏'文字", async () => {
    renderButton();
    expect(await screen.findByText("收藏")).toBeInTheDocument();
  });

  it("点击未收藏按钮后应显示已收藏", async () => {
    renderButton();
    await screen.findByText("收藏");
    act(() => screen.getByRole("button").click());
    await waitFor(() => {
      expect(screen.getByText("已收藏")).toBeInTheDocument();
    });
  });

  it("已收藏状态下点击按钮应取消收藏", async () => {
    renderButton(
      createDeps({
        getFavoriteStatusUseCase: { execute: vi.fn().mockResolvedValue(true) },
      }),
    );
    await screen.findByText("已收藏");
    act(() => screen.getByRole("button").click());
    await waitFor(() => {
      expect(screen.getByText("收藏")).toBeInTheDocument();
    });
  });

  it("收藏成功后应该前插到收藏列表 store", async () => {
    renderButton();
    await screen.findByText("收藏");
    act(() => screen.getByRole("button").click());
    await waitFor(() => {
      expect(useCollectionsStore.getState().items).toHaveLength(1);
    });

    expect(useCollectionsStore.getState().items[0]).toMatchObject({
      subjectId: mockSubject.id,
      name: mockSubject.name,
      imageUrl: mockSubject.image,
    });
  });

  it("取消收藏成功后应该从收藏列表 store 移除", async () => {
    useCollectionsStore.getState().setItems([
      {
        subjectId: mockSubject.id,
        name: mockSubject.name,
        imageUrl: mockSubject.image,
        addedAt: 1,
      },
    ]);
    renderButton(
      createDeps({
        getFavoriteStatusUseCase: { execute: vi.fn().mockResolvedValue(true) },
      }),
    );
    await screen.findByText("已收藏");
    act(() => screen.getByRole("button").click());
    await waitFor(() => {
      expect(useCollectionsStore.getState().items).toEqual([]);
    });
  });
});
