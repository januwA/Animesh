import { render, screen } from "@testing-library/react";
import type { Context } from "ajanuw-context";
import { beforeEach, vi } from "vitest";
import type { GetAnimeCharactersUseCase } from "@/application/anime/GetAnimeCharactersUseCase";
import type { AnimeCharacter } from "@/domain/anime/AnimeSchemas";
import type { UseQueryResult } from "@/presentation/hooks/useQuery";
import { useQuery } from "@/presentation/hooks/useQuery";
import { CharactersSection } from "./CharactersSection";

vi.mock(import("@/presentation/hooks/useQuery"), () => ({
  useQuery: vi.fn(),
}));

const mockedUseQuery = vi.mocked(useQuery);

// 调用方传入的 queryFn 会调用 getCharactersUseCase.execute，这里让 mock 真正执行它，
// 以覆盖 CharactersSection 内部 useQuery 的请求接线代码。
let queryResult: UseQueryResult<AnimeCharacter[]> = {
  data: [],
  loading: false,
  error: null,
  refetch: vi.fn(),
};
mockedUseQuery.mockImplementation((queryFn) => {
  queryFn({} as Context);
  return queryResult;
});

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

const makeQuery = (
  characters: AnimeCharacter[] = [],
  overrides: Partial<UseQueryResult<AnimeCharacter[]>> = {},
): UseQueryResult<AnimeCharacter[]> => ({
  data: characters,
  loading: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
});

const renderSection = (query: UseQueryResult<AnimeCharacter[]>) => {
  queryResult = query;
  return render(
    <CharactersSection
      subjectId={123}
      getCharactersUseCase={{ execute: vi.fn() }}
    />,
  );
};

const renderSectionWithExecute = (
  query: UseQueryResult<AnimeCharacter[]>,
  execute: GetAnimeCharactersUseCase["execute"],
) => {
  queryResult = query;
  return render(
    <CharactersSection subjectId={123} getCharactersUseCase={{ execute }} />,
  );
};

describe("CharactersSection 角色区域组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("当有角色数据时，应该渲染角色卡片", () => {
    renderSection(makeQuery([makeCharacter()]));

    expect(screen.getByText("ヤニねこ")).toBeInTheDocument();
    expect(screen.getByText("CV: 夏吉ゆうこ")).toBeInTheDocument();
  });

  it("当角色数据为空时，应该显示空状态提示", () => {
    renderSection(makeQuery());

    expect(screen.getByText("暂无角色数据")).toBeInTheDocument();
  });

  it("当处于加载状态时，应该显示骨架屏", () => {
    renderSection(
      makeQuery([], {
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      }),
    );

    expect(screen.getByTestId("characters-skeleton")).toBeInTheDocument();
  });

  it("当有错误时，应该显示错误状态组件", () => {
    renderSection(
      makeQuery([], {
        data: null,
        loading: false,
        error: new Error("Characters API Error"),
        refetch: vi.fn(),
      }),
    );

    expect(screen.getByText("获取角色数据失败")).toBeInTheDocument();
    expect(screen.getByText("Characters API Error")).toBeInTheDocument();
  });

  it("当有错误时，点击重试应该调用 refetch", () => {
    const refetch = vi.fn();
    renderSection(
      makeQuery([], {
        data: null,
        loading: false,
        error: new Error("Characters API Error"),
        refetch,
      }),
    );

    screen.getByRole("button", { name: "重试" }).click();

    expect(refetch).toHaveBeenCalledOnce();
  });

  it("请求函数应该调用 getCharactersUseCase.execute 并传入 subjectId 字符串", () => {
    const execute = vi
      .fn<GetAnimeCharactersUseCase["execute"]>()
      .mockResolvedValue([]);

    renderSectionWithExecute(makeQuery(), execute);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][1]).toBe("123");
  });
});
