import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AddFavoriteUseCase } from "@/application/collection/AddFavoriteUseCase";
import { GetFavoriteStatusUseCase } from "@/application/collection/GetFavoriteStatusUseCase";
import { RemoveFavoriteUseCase } from "@/application/collection/RemoveFavoriteUseCase";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { InMemoryCollectionRepository } from "@/test/InMemoryCollectionRepository";
import { FavoriteButton } from "./FavoriteButton";

function createContainer(
  repo: InMemoryCollectionRepository = new InMemoryCollectionRepository(),
): DIContainer {
  return {
    getFavoriteStatusUseCase: new GetFavoriteStatusUseCase(repo),
    addFavoriteUseCase: new AddFavoriteUseCase(repo),
    removeFavoriteUseCase: new RemoveFavoriteUseCase(repo),
  } as unknown as DIContainer;
}

describe("FavoriteButton 收藏按钮", () => {
  const mockSubject = {
    subjectId: 101,
    name: "Original Name",
    nameCn: "中文名称",
    imageUrl: "https://example.com/image.jpg",
    rating: 8.5,
    platform: "TV",
    date: "2026-07-01",
    summary: "剧情简介",
  };

  function renderWithProvider(repo?: InMemoryCollectionRepository) {
    return render(
      <DIProvider value={createContainer(repo)}>
        <FavoriteButton subject={mockSubject} />
      </DIProvider>,
    );
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it("初始状态应该显示'收藏'文字", async () => {
    renderWithProvider();
    expect(await screen.findByText("收藏")).toBeInTheDocument();
  });

  it("点击未收藏按钮后应显示已收藏", async () => {
    renderWithProvider();
    await screen.findByText("收藏");
    act(() => screen.getByRole("button").click());
    await waitFor(() => {
      expect(screen.getByText("已收藏")).toBeInTheDocument();
    });
  });

  it("已收藏状态下点击按钮应取消收藏", async () => {
    const repo = new InMemoryCollectionRepository();
    await repo.add({
      subjectId: mockSubject.subjectId,
      name: "已收藏",
      imageUrl: null,
    });
    renderWithProvider(repo);
    await screen.findByText("已收藏");
    act(() => screen.getByRole("button").click());
    await waitFor(() => {
      expect(screen.getByText("收藏")).toBeInTheDocument();
    });
  });
});
