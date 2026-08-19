import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { vi } from "vitest";
import type {
  BangumiCharacter,
  BangumiEpisode,
  BangumiPerson,
  BangumiSubject,
} from "@/domain/bangumi/BangumiSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { resetAppStores } from "@/test/store-reset";
import type { UseSubjectDetailDeps } from "./useSubjectDetail";
import { consolidateStaff, useSubjectDetail } from "./useSubjectDetail";

const locationRef: { current: { pathname: string; search: string } | null } = {
  current: null,
};
function LocationCapture() {
  locationRef.current = useLocation();
  return null;
}
function RouterWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/subject/123"]}>
      <LocationCapture />
      {children}
    </MemoryRouter>
  );
}

const makeSubject = (): BangumiSubject => ({
  id: 123,
  name: "Test Anime",
  name_cn: "测试动漫",
  summary: "简介",
  images: {
    large: "http://example.com/large.jpg",
    common: "",
    medium: "",
    small: "",
    grid: "",
  },
  rating: { score: 8.5, rank: 42, total: 100 },
  collection: { doing: 200 },
  date: "2026-07-01",
  eps: 12,
  platform: "TV",
});

const makeEpisode = (sort: number): BangumiEpisode => ({
  id: 1000 + sort,
  type: 0,
  sort,
  name: `Episode ${sort}`,
  name_cn: `第 ${sort} 集`,
  duration: "24:00",
  airdate: "2026-07-01",
  desc: "",
});

const makePerson = (overrides: Partial<BangumiPerson> = {}): BangumiPerson => ({
  images: { small: "", grid: "", large: "", medium: "" },
  name: "木村拓",
  relation: "导演",
  career: ["producer"],
  type: 1,
  id: 44615,
  eps: "",
  ...overrides,
});

const makeCharacter = (): BangumiCharacter => ({
  images: {
    small: "",
    grid: "",
    large: "http://example.com/large.jpg",
    medium: "",
  },
  name: "ヤニねこ",
  summary: "主角猫",
  relation: "主角",
  type: 1,
  id: 174916,
  actors: [
    {
      images: { small: "", grid: "", large: "", medium: "" },
      name: "夏吉ゆうこ",
      short_summary: "声优",
      career: ["seiyu"],
      id: 36024,
      type: 1,
      locked: false,
    },
  ],
});

const makeTorrent = (
  overrides: Partial<TorrentStatusInfo>,
): TorrentStatusInfo => ({
  info_hash: NonEmptyStringSchema.parse("hash-1"),
  name: NonEmptyStringSchema.parse("测试种子"),
  progress_bytes: 100,
  total_bytes: 100,
  finished: false,
  download_speed_bytes_per_sec: 0,
  upload_speed_bytes_per_sec: 0,
  paused: false,
  peers_connected: 0,
  peers_total: 0,
  trackers: [],
  ...overrides,
});

const makeDeps = (
  overrides: Partial<UseSubjectDetailDeps> = {},
): UseSubjectDetailDeps => ({
  getBangumiSubjectUseCase: {
    execute: vi.fn().mockResolvedValue(makeSubject()),
  },
  getBangumiEpisodesUseCase: {
    execute: vi.fn().mockResolvedValue({
      items: [makeEpisode(2), makeEpisode(1)],
      total: 2,
    }),
  },
  getBangumiPersonsUseCase: { execute: vi.fn().mockResolvedValue([]) },
  getBangumiCharactersUseCase: { execute: vi.fn().mockResolvedValue([]) },
  openUrlUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
  setTorrentSubjectUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
  clearTorrentSubjectUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
  ...overrides,
});

const renderPage = async (
  params: Parameters<typeof useSubjectDetail>[0],
  deps: UseSubjectDetailDeps,
) => {
  const hook = renderHook(() => useSubjectDetail(params, deps), {
    wrapper: RouterWrapper,
  });
  await act(async () => {});
  return { result: hook.result, deps, unmount: hook.unmount };
};

describe("useSubjectDetail 条目详情 hook", () => {
  beforeEach(() => {
    locationRef.current = null;
    resetAppStores();
    vi.clearAllMocks();
  });

  it("应该加载动漫详情、剧集、角色与制作人员数据", async () => {
    const deps = makeDeps({
      getBangumiPersonsUseCase: {
        execute: vi.fn().mockResolvedValue([makePerson()]),
      },
      getBangumiCharactersUseCase: {
        execute: vi.fn().mockResolvedValue([makeCharacter()]),
      },
    });
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

    await waitFor(() => {
      expect(result.current.subject?.name_cn).toBe("测试动漫");
    });
    expect(result.current.episodes).toHaveLength(2);
    expect(result.current.episodes[0].sort).toBe(1);
    expect(result.current.characters).toHaveLength(1);
    expect(result.current.persons).toHaveLength(1);
    expect(deps.getBangumiSubjectUseCase.execute).toHaveBeenCalledWith(
      expect.anything(),
      NonEmptyStringSchema.parse("123"),
    );
  });

  it("剧集应该按 sort 升序排列，并计算总页数", async () => {
    const deps = makeDeps({
      getBangumiEpisodesUseCase: {
        execute: vi.fn().mockResolvedValue({
          items: Array.from({ length: 103 }, (_, i) => makeEpisode(i + 1)),
          total: 103,
        }),
      },
    });
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

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

  it("应该派生 displayName / originalName / imageUrl", async () => {
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      makeDeps(),
    );

    await waitFor(() => {
      expect(result.current.subject).not.toBeNull();
    });
    expect(result.current.displayName).toBe("测试动漫");
    expect(result.current.originalName).toBe("Test Anime");
    expect(result.current.imageUrl).toBe("http://example.com/large.jpg");
  });

  it("无中文名时 displayName 回退到原名且不显示 originalName", async () => {
    const deps = makeDeps({
      getBangumiSubjectUseCase: {
        execute: vi.fn().mockResolvedValue({ ...makeSubject(), name_cn: "" }),
      },
    });
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

    await waitFor(() => {
      expect(result.current.subject).not.toBeNull();
    });
    expect(result.current.displayName).toBe("Test Anime");
    expect(result.current.originalName).toBe("");
  });

  it("应该按角色分组制作人员并正确去重", async () => {
    const deps = makeDeps({
      getBangumiPersonsUseCase: {
        execute: vi
          .fn()
          .mockResolvedValue([
            makePerson(),
            makePerson(),
            makePerson({ relation: "脚本", eps: "1-3" }),
          ]),
      },
    });
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

    await waitFor(() => {
      expect(result.current.persons).toHaveLength(3);
    });
    expect(result.current.consolidatedStaff).toHaveLength(1);
    expect(result.current.consolidatedStaff[0].relations).toEqual([
      "导演",
      "脚本",
    ]);
    expect(result.current.staffGroupedByRole.get("导演")).toHaveLength(1);
    expect(result.current.staffGroupedByRole.get("脚本")).toHaveLength(1);
  });

  it("应该统计绑定资源数量并拆分已绑定/未绑定资源", async () => {
    const torrents = [
      makeTorrent({ subject_id: 123 }),
      makeTorrent({ info_hash: NonEmptyStringSchema.parse("hash-2") }),
    ];
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents },
      makeDeps(),
    );

    expect(result.current.boundResourcesCount).toBe(1);
    expect(result.current.boundTorrents).toHaveLength(1);
    expect(result.current.unboundTorrents).toHaveLength(1);
  });

  it("点击剧集时应该跳转到主页搜索", async () => {
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      makeDeps(),
    );

    await waitFor(() => {
      expect(result.current.subject).not.toBeNull();
    });
    act(() => result.current.handleEpisodeClick(makeEpisode(1)));
    expect(locationRef.current?.pathname).toBe("/");
    expect(locationRef.current?.search).toBe(
      `?keyword=${encodeURIComponent("测试动漫 01")}`,
    );
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
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

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
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

    await waitFor(() => {
      expect(result.current.totalPages).toBe(3);
    });
    act(() => result.current.jumpToEpisode(123));
    await waitFor(() => {
      expect(locationRef.current?.search).toContain("page=3");
    });
  });

  it("绑定资源成功时应该调用 setTorrentSubjectUseCase 并提示成功", async () => {
    const deps = makeDeps({
      setTorrentSubjectUseCase: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    });
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

    await waitFor(() => {
      expect(result.current.subject).not.toBeNull();
    });
    await act(async () => {
      await result.current.handleBind("hash-1");
    });
    expect(deps.setTorrentSubjectUseCase.execute).toHaveBeenCalledWith({
      infoHash: NonEmptyStringSchema.parse("hash-1"),
      subjectId: 123,
      subjectName: NonEmptyStringSchema.parse("测试动漫"),
    });
    expect(toast.success).toHaveBeenCalledWith("已绑定下载资源");
  });

  it("绑定资源失败时应该提示错误", async () => {
    const deps = makeDeps({
      setTorrentSubjectUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("Bind failed")),
      },
    });
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

    await waitFor(() => {
      expect(result.current.subject).not.toBeNull();
    });
    await act(async () => {
      await result.current.handleBind("hash-1");
    });
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("绑定失败: Bind failed"),
    );
  });

  it("解绑资源时应该调用 clearTorrentSubjectUseCase", async () => {
    const deps = makeDeps({
      clearTorrentSubjectUseCase: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    });
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

    await act(async () => {
      await result.current.handleUnbind(NonEmptyStringSchema.parse("hash-1"));
    });
    expect(deps.clearTorrentSubjectUseCase.execute).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("hash-1"),
    );
    expect(toast.success).toHaveBeenCalledWith("已解除绑定");
  });

  it("解绑资源失败时应该显示错误提示", async () => {
    const deps = makeDeps({
      clearTorrentSubjectUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("解绑失败")),
      },
    });
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

    await act(async () => {
      try {
        await result.current.handleUnbind(NonEmptyStringSchema.parse("hash-1"));
      } catch {
        // 忽略错误
      }
    });

    expect(deps.clearTorrentSubjectUseCase.execute).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("hash-1"),
    );
    expect(toast.error).toHaveBeenCalledWith("解绑失败: 解绑失败");
  });

  it("打开详情链接时应该调用 openUrlUseCase", async () => {
    const deps = makeDeps({
      openUrlUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
    });
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

    await waitFor(() => {
      expect(result.current.subject).not.toBeNull();
    });
    act(() => result.current.handleOpenUrl());
    await waitFor(() => {
      expect(deps.openUrlUseCase.execute).toHaveBeenCalledWith(
        NonEmptyStringSchema.parse("https://bgm.tv/subject/123"),
      );
    });
  });

  it("动漫详情接口失败时应该暴露错误", async () => {
    const deps = makeDeps({
      getBangumiSubjectUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("Subject API Error")),
      },
    });
    const { result } = await renderPage(
      { subjectId: 123, page: 1, torrents: [] },
      deps,
    );

    await waitFor(() => {
      expect(result.current.subjectQuery.error).not.toBeNull();
    });
    expect(result.current.subjectQuery.error?.message).toBe(
      "Subject API Error",
    );
  });
});

describe("consolidateStaff 制作人员去重", () => {
  it("同一个人相同角色出现多次时应去重，不同角色应合并", () => {
    const staff = consolidateStaff([
      makePerson(),
      makePerson(),
      makePerson({ relation: "脚本", eps: "1-3" }),
    ]);
    expect(staff).toHaveLength(1);
    expect(staff[0].relations).toEqual(["导演", "脚本"]);
    expect(staff[0].eps).toBe("");
  });

  it("图片为空时 image 字段应为空字符串", () => {
    const staff = consolidateStaff([makePerson()]);
    expect(staff[0].image).toBe("");
  });
});
