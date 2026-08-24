import { render, screen } from "@testing-library/react";
import type { BangumiCharacter } from "@/domain/bangumi/BangumiSchemas";
import { CharacterCard } from "./CharacterCard";

const makeCharacter = (
  overrides: Partial<BangumiCharacter> = {},
): BangumiCharacter => ({
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

describe("CharacterCard 角色卡片组件", () => {
  it("应该渲染角色名称和声优信息", () => {
    render(<CharacterCard character={makeCharacter()} />);

    expect(screen.getByText("ヤニねこ")).toBeInTheDocument();
    expect(screen.getByText("CV: 夏吉ゆうこ")).toBeInTheDocument();
  });

  it("应该显示角色关系徽章", () => {
    render(<CharacterCard character={makeCharacter()} />);

    expect(screen.getByText("主角")).toBeInTheDocument();
  });

  it("当有多名声优时，应该显示额外声优计数", () => {
    render(
      <CharacterCard
        character={makeCharacter({
          actors: [
            {
              name: "声優A",
            },
            {
              name: "声優B",
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("CV: 声優A")).toBeInTheDocument();
    expect(screen.getByText("+1 位声优")).toBeInTheDocument();
  });

  it("当没有声优时，不应该显示 CV 信息", () => {
    render(<CharacterCard character={makeCharacter({ actors: [] })} />);

    expect(screen.getByText("ヤニねこ")).toBeInTheDocument();
    expect(screen.queryByText(/CV:/)).not.toBeInTheDocument();
  });

  it("当 relation 为空时，不应该显示关系徽章", () => {
    render(<CharacterCard character={makeCharacter({ relation: "" })} />);

    expect(screen.getByText("ヤニねこ")).toBeInTheDocument();
    expect(screen.queryByText("主角")).not.toBeInTheDocument();
  });
});
