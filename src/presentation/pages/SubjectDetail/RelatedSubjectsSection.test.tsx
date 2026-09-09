import { render, screen } from "@testing-library/react";
import type { Context } from "ajanuw-context";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import type { AnimeRelatedSubject } from "@/domain/anime/AnimeSchemas";
import type { UseQueryResult } from "@/presentation/hooks/useQuery";
import { useQuery } from "@/presentation/hooks/useQuery";
import { RelatedSubjectsSection } from "./RelatedSubjectsSection";

vi.mock(import("@/presentation/hooks/useQuery"), () => ({
  useQuery: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual: object = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockedUseQuery = vi.mocked(useQuery);

let queryResult: UseQueryResult<AnimeRelatedSubject[]> = {
  data: [],
  loading: false,
  error: null,
  refetch: vi.fn(),
};
mockedUseQuery.mockImplementation((queryFn) => {
  queryFn({} as Context);
  return queryResult;
});

const makeRelatedSubject = (
  overrides: Partial<AnimeRelatedSubject> = {},
): AnimeRelatedSubject => ({
  id: 2,
  name: "续作条目",
  image: "http://example.com/cover.jpg",
  relation: "续集",
  ...overrides,
});

const makeQuery = (
  subjects: AnimeRelatedSubject[] = [],
  overrides: Partial<UseQueryResult<AnimeRelatedSubject[]>> = {},
): UseQueryResult<AnimeRelatedSubject[]> => ({
  data: subjects,
  loading: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
});

const renderSection = (query: UseQueryResult<AnimeRelatedSubject[]>) => {
  queryResult = query;
  return render(
    <MemoryRouter>
      <RelatedSubjectsSection
        subjectId={123}
        platform="bangumi"
        getRelatedSubjectsUseCase={{ execute: vi.fn() }}
      />
    </MemoryRouter>,
  );
};

describe("RelatedSubjectsSection 关联条目区域组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("当有关联条目数据时，应该渲染条目卡片", () => {
    renderSection(makeQuery([makeRelatedSubject()]));

    expect(screen.getByText("续作条目")).toBeInTheDocument();
    expect(screen.getByText("续集")).toBeInTheDocument();
  });

  it("当关联条目数据为空时，应该显示空状态提示", () => {
    renderSection(makeQuery());

    expect(screen.getByText("暂无关联网目")).toBeInTheDocument();
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

    expect(screen.getByTestId("related-subjects-skeleton")).toBeInTheDocument();
  });

  it("当有错误时，应该显示错误状态组件", () => {
    renderSection(
      makeQuery([], {
        data: null,
        loading: false,
        error: new Error("Related subjects API Error"),
        refetch: vi.fn(),
      }),
    );

    expect(screen.getByText("获取关联条目失败")).toBeInTheDocument();
    expect(screen.getByText("Related subjects API Error")).toBeInTheDocument();
  });

  it("当有错误时，点击重试应该调用 refetch", () => {
    const refetch = vi.fn();
    renderSection(
      makeQuery([], {
        data: null,
        loading: false,
        error: new Error("Related subjects API Error"),
        refetch,
      }),
    );

    screen.getByRole("button", { name: "重试" }).click();

    expect(refetch).toHaveBeenCalledOnce();
  });

  it("点击条目卡片时应该导航到对应条目详情页", () => {
    renderSection(makeQuery([makeRelatedSubject()]));

    screen.getByTitle("详情: 续作条目").click();

    expect(mockNavigate).toHaveBeenCalledWith(
      "/anime/subject/2?platform=bangumi",
      {
        viewTransition: true,
        state: { name: "续作条目", imageUrl: "http://example.com/cover.jpg" },
      },
    );
  });
});
