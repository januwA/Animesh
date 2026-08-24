import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { AnimeCharacter } from "@/domain/anime/AnimeSchemas";
import { CharactersSection } from "@/presentation/components/CharactersSection";

const makeCharacter = (
  overrides: Partial<AnimeCharacter> = {},
): AnimeCharacter => ({
  image: "http://example.com/large.jpg",
  name: "ヤニねこ",
  relation: "主角",
  id: 174916,
  actors: [
    {
      name: "夏吉ゆうこ",
    },
  ],
  ...overrides,
});

describe("CharactersSection 角色区域组件", () => {
  it("当有角色数据时，应该渲染角色卡片", () => {
    render(
      <CharactersSection
        characters={[makeCharacter()]}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("ヤニねこ")).toBeInTheDocument();
    expect(screen.getByText("CV: 夏吉ゆうこ")).toBeInTheDocument();
  });

  it("当角色数据为空时，应该显示空状态提示", () => {
    render(
      <CharactersSection
        characters={[]}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("暂无角色数据")).toBeInTheDocument();
  });

  it("当处于加载状态时，应该显示骨架屏", () => {
    render(
      <CharactersSection
        characters={[]}
        loading={true}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByTestId("characters-skeleton")).toBeInTheDocument();
  });

  it("当有错误时，应该显示错误状态组件", () => {
    render(
      <CharactersSection
        characters={[]}
        loading={false}
        error={new Error("Characters API Error")}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("获取角色数据失败")).toBeInTheDocument();
    expect(screen.getByText("Characters API Error")).toBeInTheDocument();
  });

  it("当有错误时，点击重试应该调用 onRetry", () => {
    const onRetry = vi.fn();
    render(
      <CharactersSection
        characters={[]}
        loading={false}
        error={new Error("Characters API Error")}
        onRetry={onRetry}
      />,
    );

    screen.getByRole("button", { name: "重试" }).click();

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
