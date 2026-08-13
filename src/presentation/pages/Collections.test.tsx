import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { InMemoryCollectionRepository } from "@/test/InMemoryCollectionRepository";
import Collections from "./Collections";

function createContainer(): DIContainer {
  const collectionRepository = new InMemoryCollectionRepository();
  return {
    collectionRepository,
  } as unknown as DIContainer;
}

function renderWithProvider(container: DIContainer) {
  return render(
    <DIProvider value={container}>
      <MemoryRouter>
        <Collections />
      </MemoryRouter>
    </DIProvider>,
  );
}

describe("Collections 收藏页面", () => {
  it("空状态应显示提示信息和导航按钮", async () => {
    const container = createContainer();
    renderWithProvider(container);
    expect(await screen.findByText("还没有收藏任何条目")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "去新番日历看看" }),
    ).toBeInTheDocument();
  });

  it("有收藏时应显示收藏条目", async () => {
    const container = createContainer();
    await (container.collectionRepository as InMemoryCollectionRepository).add({
      subjectId: 101,
      name: "测试动画",
      imageUrl: null,
    });
    const { container: dom } = render(
      <DIProvider value={container}>
        <MemoryRouter>
          <Collections />
        </MemoryRouter>
      </DIProvider>,
    );
    await waitFor(() => {
      expect(dom.textContent).toContain("测试动画");
    });
  });

  it("点击空状态导航按钮应跳转到日历页", async () => {
    const container = createContainer();
    renderWithProvider(container);
    expect(await screen.findByText("我的收藏")).toBeInTheDocument();
    await screen.findByText("还没有收藏任何条目");
    fireEvent.click(screen.getByRole("button", { name: "去新番日历看看" }));
  });

  it("应展示有封面的收藏条目且点击可触发导航", async () => {
    const container = createContainer();
    await (container.collectionRepository as InMemoryCollectionRepository).add({
      subjectId: 201,
      name: "带封面动画",
      imageUrl: "https://example.com/cover.jpg",
    });
    const { container: dom } = render(
      <DIProvider value={container}>
        <MemoryRouter>
          <Collections />
        </MemoryRouter>
      </DIProvider>,
    );
    await waitFor(() => {
      expect(dom.textContent).toContain("带封面动画");
    });
    fireEvent.click(screen.getByTitle("详情: 带封面动画"));
  });

  it("中文名为空时应回退显示英文名", async () => {
    const container = createContainer();
    await (container.collectionRepository as InMemoryCollectionRepository).add({
      subjectId: 401,
      name: "EnglishName",
      imageUrl: null,
    });
    const { container: dom } = render(
      <DIProvider value={container}>
        <MemoryRouter>
          <Collections />
        </MemoryRouter>
      </DIProvider>,
    );
    await waitFor(() => {
      expect(dom.textContent).toContain("EnglishName");
    });
    fireEvent.click(screen.getByTitle("详情: EnglishName"));
  });
});
