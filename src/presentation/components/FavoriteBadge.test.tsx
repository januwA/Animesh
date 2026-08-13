import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { InMemoryCollectionRepository } from "@/test/InMemoryCollectionRepository";
import { FavoriteBadge } from "./FavoriteBadge";

function createContainer(): DIContainer {
  const collectionRepository = new InMemoryCollectionRepository();
  return {
    collectionRepository,
  } as unknown as DIContainer;
}

describe("FavoriteBadge 收藏徽标", () => {
  const subjectId = 101;

  beforeEach(() => {
    localStorage.clear();
  });

  it("当未收藏时不应渲染", async () => {
    const container = createContainer();
    const { container: dom } = render(
      <DIProvider value={container}>
        <FavoriteBadge subjectId={subjectId} />
      </DIProvider>,
    );
    await waitFor(() => {
      expect(dom.querySelector(".h-6.w-6")).toBeNull();
    });
  });

  it("当已收藏时应渲染心形图标", async () => {
    const container = createContainer();
    await (container.collectionRepository as InMemoryCollectionRepository).add({
      subjectId,
      name: "Name",
      imageUrl: null,
    });
    const { container: dom } = render(
      <DIProvider value={container}>
        <FavoriteBadge subjectId={subjectId} />
      </DIProvider>,
    );
    await waitFor(() => {
      expect(dom.querySelector(".absolute")).toBeInTheDocument();
    });
  });
});
