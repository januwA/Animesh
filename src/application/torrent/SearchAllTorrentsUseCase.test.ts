import { Background, WithValue } from "ajanuw-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRACE_ID } from "@/domain/common/ContextKeys";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { SearchAllTorrentsUseCase } from "./SearchAllTorrentsUseCase";
import type { SearchTorrentsUseCase } from "./SearchTorrentsUseCase";

describe("SearchAllTorrentsUseCase 多引擎搜索并去重合并", () => {
  const searchTorrentsUseCase = {
    execute: vi.fn(),
  } as unknown as SearchTorrentsUseCase;

  let useCase: SearchAllTorrentsUseCase;

  const makeItem = (
    title: string,
    options: { link?: string; pubDate?: string } = {},
  ): SearchResultItem => ({
    title: NonEmptyStringSchema.parse(title),
    link: NonEmptyStringSchema.parse(
      `http://example.com/${options.link ?? title}`,
    ),
    pub_date: options.pubDate ?? "2026-06-23T12:00:00Z",
    magnet: NonEmptyStringSchema.parse("magnet:?xt=urn:btih:TEST1"),
    description: "",
  });

  const ctx = WithValue(Background, TRACE_ID, "test-trace");

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SearchAllTorrentsUseCase(searchTorrentsUseCase);
  });

  it("应该并发调用每引擎的搜索并合并结果", async () => {
    vi.mocked(searchTorrentsUseCase.execute)
      .mockResolvedValueOnce([makeItem("xxx 第1集")])
      .mockResolvedValueOnce([makeItem("yyy 第1集")]);

    const results = await useCase.execute(ctx, {
      keyword: NonEmptyStringSchema.parse("xxx"),
      engines: ["dmhy", "nyaa"],
    });

    expect(searchTorrentsUseCase.execute).toHaveBeenCalledTimes(2);
    expect(searchTorrentsUseCase.execute).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ keyword: "xxx", engine: "dmhy" }) as object,
    );
    expect(searchTorrentsUseCase.execute).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ keyword: "xxx", engine: "nyaa" }) as object,
    );
    expect(results.map((r) => r.title)).toEqual(["xxx 第1集", "yyy 第1集"]);
  });

  it("同一 title 且 pub_date 在 10 分钟内应去重（保留首个出现项）", async () => {
    const first = makeItem("xxx 第1集", {
      link: "a",
      pubDate: "2026-06-23T12:00:00Z",
    });
    const duplicate = makeItem("xxx 第1集", {
      link: "b",
      pubDate: "2026-06-23T12:08:00Z",
    });
    vi.mocked(searchTorrentsUseCase.execute)
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([duplicate]);

    const results = await useCase.execute(ctx, {
      keyword: NonEmptyStringSchema.parse("xxx"),
      engines: ["dmhy", "nyaa"],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(first);
  });

  it("同一 title 但 pub_date 相隔超过 10 分钟应保留两条", async () => {
    const earlier = makeItem("xxx 第1集", {
      link: "a",
      pubDate: "2026-06-23T12:00:00Z",
    });
    const later = makeItem("xxx 第1集", {
      link: "b",
      pubDate: "2026-06-23T12:15:00Z",
    });
    vi.mocked(searchTorrentsUseCase.execute)
      .mockResolvedValueOnce([earlier])
      .mockResolvedValueOnce([later]);

    const results = await useCase.execute(ctx, {
      keyword: NonEmptyStringSchema.parse("xxx"),
      engines: ["dmhy", "nyaa"],
    });

    expect(results).toHaveLength(2);
  });

  it("同一 title、与已保留任一发布时间相距 10 分钟内的多条都应去重", async () => {
    vi.mocked(searchTorrentsUseCase.execute)
      .mockResolvedValueOnce([
        makeItem("xxx 第1集", {
          pubDate: "2026-06-23T12:00:00Z",
        }),
      ])
      .mockResolvedValueOnce([
        makeItem("xxx 第1集", {
          link: "c",
          pubDate: "2026-06-23T12:10:00Z",
        }),
        makeItem("xxx 第1集", {
          link: "d",
          pubDate: "2026-06-23T12:20:00Z",
        }),
      ]);

    const results = await useCase.execute(ctx, {
      keyword: NonEmptyStringSchema.parse("xxx"),
      engines: ["dmhy", "nyaa"],
    });

    // 12:10 与 12:00 相距 10 分钟内 → 去重；
    // 12:20 与 12:00 相距 20 分钟超窗 → 保留
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.link)).toEqual([
      "http://example.com/xxx 第1集",
      "http://example.com/d",
    ]);
  });

  it("title 仅空白/大小写不同且时间相近的同一资源应去重", async () => {
    vi.mocked(searchTorrentsUseCase.execute)
      .mockResolvedValueOnce([makeItem("[Group] 某番 01")])
      .mockResolvedValueOnce([
        makeItem("  [group]  某番  01 ", {
          pubDate: "2026-06-23T12:05:00Z",
        }),
      ]);

    const results = await useCase.execute(ctx, {
      keyword: NonEmptyStringSchema.parse("某番"),
      engines: ["dmhy", "nyaa"],
    });

    expect(results).toHaveLength(1);
  });

  it("部分引擎失败时保留成功结果", async () => {
    vi.mocked(searchTorrentsUseCase.execute)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce([makeItem("yyy 第1集")]);

    const results = await useCase.execute(ctx, {
      keyword: NonEmptyStringSchema.parse("xxx"),
      engines: ["dmhy", "nyaa"],
    });

    expect(results.map((r) => r.title)).toEqual(["yyy 第1集"]);
  });

  it("非法 pub_date 的条目不参与去重、单独保留，且不影响后续时间记录", async () => {
    vi.mocked(searchTorrentsUseCase.execute)
      .mockResolvedValueOnce([makeItem("xxx 第1集", { pubDate: "not-a-date" })])
      .mockResolvedValueOnce([
        makeItem("xxx 第1集", { link: "b", pubDate: "2026-06-23T12:00:00Z" }),
      ]);

    const results = await useCase.execute(ctx, {
      keyword: NonEmptyStringSchema.parse("xxx"),
      engines: ["dmhy", "nyaa"],
    });

    // 非法 pub_date 无法解析 → 不触发去重，两条都应保留
    expect(results).toHaveLength(2);
  });

  it("引擎列表为空时返回空结果且不抛错", async () => {
    const results = await useCase.execute(ctx, {
      keyword: NonEmptyStringSchema.parse("xxx"),
      engines: [],
    });

    expect(searchTorrentsUseCase.execute).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  it("已记录过合法时间的同 title 再次出现非法 pub_date 时走 no-op 并单独保留", async () => {
    vi.mocked(searchTorrentsUseCase.execute)
      .mockResolvedValueOnce([
        makeItem("xxx 第1集", { pubDate: "2026-06-23T12:00:00Z" }),
      ])
      .mockResolvedValueOnce([
        makeItem("xxx 第1集", { link: "b", pubDate: "not-a-date" }),
      ]);

    const results = await useCase.execute(ctx, {
      keyword: NonEmptyStringSchema.parse("xxx"),
      engines: ["dmhy", "nyaa"],
    });

    // 非法 pub_date 无法解析 → 不触发去重，也不污染已记录的合法时间，两条都保留
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.link).sort()).toEqual([
      "http://example.com/b",
      "http://example.com/xxx 第1集",
    ]);
  });

  it("全部引擎失败时抛出首个错误", async () => {
    const firstError = new Error("first boom");
    vi.mocked(searchTorrentsUseCase.execute)
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(new Error("second boom"));

    await expect(
      useCase.execute(ctx, {
        keyword: NonEmptyStringSchema.parse("xxx"),
        engines: ["dmhy", "nyaa"],
      }),
    ).rejects.toBe(firstError);
  });
});
