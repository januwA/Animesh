import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { vi } from "vitest";
import type { AnimeEpisode, AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { UseSubjectEpisodesDeps } from "./useSubjectEpisodes";
import { useSubjectEpisodes } from "./useSubjectEpisodes";

const locationRef: { current: { pathname: string; search: string } | null } = {
  current: null,
};
function LocationCapture() {
  locationRef.current = useLocation();
  return null;
}

const makeSubject = (): AnimeSubject => ({
  id: 123,
  name: "测试动漫",
  summary: "简介",
  image: "",
  rating: 8.5,
  date: "2026-07-01",
  eps: 12,
  platform: "TV",
});

const makeEpisode = (sort: number): AnimeEpisode => ({
  id: 1000 + sort,
  sort,
  name: `第 ${sort} 集`,
  duration: "24:00",
  airdate: "2026-07-01",
});

const makeDeps = (
  overrides: Partial<UseSubjectEpisodesDeps> = {},
): UseSubjectEpisodesDeps => ({
  getBangumiEpisodesUseCase: {
    execute: vi.fn().mockResolvedValue({
      items: [makeEpisode(2), makeEpisode(1)],
      total: 2,
    }),
  },
  ...overrides,
});

const renderEpisodes = (
  deps: UseSubjectEpisodesDeps,
  { page = 1, subject = makeSubject() } = {},
) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={["/subject/123"]}>
      <LocationCapture />
      {children}
    </MemoryRouter>
  );
  const hook = renderHook(
    () => useSubjectEpisodes({ subjectId: 123, page, subject }, deps),
    { wrapper },
  );
  return { result: hook.result, deps };
};

describe("useSubjectEpisodes 剧集分页 hook", () => {
  beforeEach(() => {
    locationRef.current = null;
    vi.clearAllMocks();
  });

  it("应该加载剧集并按 sort 升序排列、计算总页数", async () => {
    const deps = makeDeps({
      getBangumiEpisodesUseCase: {
        execute: vi.fn().mockResolvedValue({
          items: Array.from({ length: 103 }, (_, i) => makeEpisode(i + 1)),
          total: 103,
        }),
      },
    });
    const { result } = renderEpisodes(deps);

    await waitFor(() => {
      expect(result.current.episodes).toHaveLength(103);
    });
    expect(result.current.totalEpisodes).toBe(103);
    expect(result.current.totalPages).toBe(3);
    expect(deps.getBangumiEpisodesUseCase.execute).toHaveBeenCalledWith(
      expect.anything(),
      { subjectId: NonEmptyStringSchema.parse("123"), offset: 0, limit: 50 },
    );
  });

  it("todayStr 应返回 YYYY-MM-DD 格式", async () => {
    const { result } = renderEpisodes(makeDeps());
    await waitFor(() => {
      expect(result.current.episodes).toHaveLength(2);
    });
    expect(result.current.todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("changePage 应该更新 URL 的 page 参数并限制范围", async () => {
    const deps = makeDeps({
      getBangumiEpisodesUseCase: {
        execute: vi.fn().mockResolvedValue({
          items: Array.from({ length: 103 }, (_, i) => makeEpisode(i + 1)),
          total: 103,
        }),
      },
    });
    const { result } = renderEpisodes(deps);

    await waitFor(() => {
      expect(result.current.totalPages).toBe(3);
    });
    act(() => result.current.changePage(99));
    await waitFor(() => {
      expect(locationRef.current?.search).toContain("page=3");
    });
  });

  it("jumpToEpisode 应该切换到对应页码", async () => {
    const deps = makeDeps({
      getBangumiEpisodesUseCase: {
        execute: vi.fn().mockResolvedValue({
          items: Array.from({ length: 103 }, (_, i) => makeEpisode(i + 1)),
          total: 103,
        }),
      },
    });
    const { result } = renderEpisodes(deps);

    await waitFor(() => {
      expect(result.current.totalPages).toBe(3);
    });
    act(() => result.current.jumpToEpisode(123));
    await waitFor(() => {
      expect(locationRef.current?.search).toContain("page=3");
    });
  });

  it("点击剧集时应该跳转到主页搜索", async () => {
    const { result } = renderEpisodes(makeDeps());

    await waitFor(() => {
      expect(result.current.episodes).toHaveLength(2);
    });
    act(() => result.current.handleEpisodeClick(makeEpisode(1)));
    expect(locationRef.current?.pathname).toBe("/");
    expect(locationRef.current?.search).toBe(
      `?keyword=${encodeURIComponent("测试动漫 01")}`,
    );
  });
});
