import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type { UseDownloadsDataDeps } from "./useDownloadsData";
import { groupTorrents, useDownloadsData } from "./useDownloadsData";

const makeHash = (value: string) => NonEmptyStringSchema.parse(value);
const makeName = (value: string) => NonEmptyStringSchema.parse(value);

const makeStatus = (
  overrides: Partial<TorrentStatusInfo> = {},
): TorrentStatusInfo => ({
  info_hash: makeHash("hash123"),
  name: makeName("测试任务"),
  progress_bytes: 400,
  total_bytes: 1000,
  finished: false,
  download_speed_bytes_per_sec: 100,
  upload_speed_bytes_per_sec: 100,
  paused: false,
  peers_connected: 0,
  peers_total: 0,
  trackers: [],
  ...overrides,
});

const makeDeps = (
  overrides: Partial<UseDownloadsDataDeps> = {},
): UseDownloadsDataDeps => ({
  pauseTorrentUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
  resumeTorrentUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
  deleteTorrentUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
  ...overrides,
});

describe("groupTorrents 分组纯函数", () => {
  it("应该按条目分组、组内按创建时间倒序，并将未绑定任务归入 unbound", () => {
    const torrents = [
      makeStatus({
        info_hash: makeHash("hashU"),
        name: makeName("未绑定"),
        created_at: 3000,
      }),
      makeStatus({
        info_hash: makeHash("hashA2"),
        name: makeName("A-第2话"),
        created_at: 2000,
        subject_id: 42,
        subject_name: makeName("动漫A"),
      }),
      makeStatus({
        info_hash: makeHash("hashA1"),
        name: makeName("A-第1话"),
        created_at: 1000,
        subject_id: 42,
        subject_name: makeName("动漫A"),
      }),
      makeStatus({
        info_hash: makeHash("hashB"),
        name: makeName("B-第1话"),
        created_at: 500,
        subject_id: 43,
        subject_name: makeName("动漫B"),
      }),
      makeStatus({
        info_hash: makeHash("hashNoName"),
        name: makeName("缺名"),
        subject_id: 44,
      }),
    ];

    const { groups, unbound } = groupTorrents(torrents);

    expect(groups).toHaveLength(2);
    const groupA = groups.find((g) => g.subjectId === 42)!;
    expect(groupA.items.map((t) => t.name)).toEqual([
      makeName("A-第2话"),
      makeName("A-第1话"),
    ]);
    expect(unbound.map((t) => t.info_hash)).toEqual([
      makeHash("hashU"),
      makeHash("hashNoName"),
    ]);
  });
});

describe("useDownloadsData 下载页数据 hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该返回按条目分组的数据与未绑定任务", () => {
    const torrents = [
      makeStatus({ info_hash: makeHash("hashU"), name: makeName("未绑定") }),
      makeStatus({
        info_hash: makeHash("hashA"),
        name: makeName("A-第1话"),
        subject_id: 42,
        subject_name: makeName("动漫A"),
      }),
    ];

    const { result } = renderHook(
      () => useDownloadsData({ torrents }, makeDeps()),
      { wrapper: MemoryRouter },
    );

    expect(result.current.visibleTorrents).toHaveLength(2);
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.unbound).toHaveLength(1);
  });

  it("暂停任务应该调用 pause use case 并提示", async () => {
    const status = makeStatus();
    const pauseExecute = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        useDownloadsData(
          { torrents: [status] },
          makeDeps({ pauseTorrentUseCase: { execute: pauseExecute } }),
        ),
      { wrapper: MemoryRouter },
    );

    await act(async () => {
      result.current.handleTogglePause(status);
    });

    await waitFor(() => {
      expect(pauseExecute).toHaveBeenCalledWith(status.info_hash);
      expect(toast).toHaveBeenCalledWith("已暂停任务: 测试任务");
      expect(result.current.pendingPauseHash).toBeNull();
    });
  });

  it("暂停失败应该提示错误", async () => {
    const status = makeStatus();
    const pauseExecute = vi.fn().mockRejectedValue("Pause error");
    const { result } = renderHook(
      () =>
        useDownloadsData(
          { torrents: [status] },
          makeDeps({ pauseTorrentUseCase: { execute: pauseExecute } }),
        ),
      { wrapper: MemoryRouter },
    );

    await act(async () => {
      result.current.handleTogglePause(status);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("暂停失败"),
      );
      expect(result.current.pendingPauseHash).toBeNull();
    });
  });

  it("恢复暂停任务应该调用 resume use case 并提示", async () => {
    const status = makeStatus({ paused: true });
    const resumeExecute = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        useDownloadsData(
          { torrents: [status] },
          makeDeps({ resumeTorrentUseCase: { execute: resumeExecute } }),
        ),
      { wrapper: MemoryRouter },
    );

    await act(async () => {
      result.current.handleTogglePause(status);
    });

    await waitFor(() => {
      expect(resumeExecute).toHaveBeenCalledWith(status.info_hash);
      expect(toast.success).toHaveBeenCalledWith("已开始下载任务: 测试任务");
      expect(result.current.pendingResumeHash).toBeNull();
    });
  });

  it("恢复失败应该提示错误", async () => {
    const status = makeStatus({ paused: true });
    const resumeExecute = vi.fn().mockRejectedValue("Resume error");
    const { result } = renderHook(
      () =>
        useDownloadsData(
          { torrents: [status] },
          makeDeps({ resumeTorrentUseCase: { execute: resumeExecute } }),
        ),
      { wrapper: MemoryRouter },
    );

    await act(async () => {
      result.current.handleTogglePause(status);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("启动失败"),
      );
      expect(result.current.pendingResumeHash).toBeNull();
    });
  });

  it("删除成功后应该乐观隐藏对应任务并提示", async () => {
    const status = makeStatus();
    const deleteExecute = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        useDownloadsData(
          { torrents: [status] },
          makeDeps({ deleteTorrentUseCase: { execute: deleteExecute } }),
        ),
      { wrapper: MemoryRouter },
    );
    expect(result.current.visibleTorrents).toHaveLength(1);

    await act(async () => {
      result.current.handleDelete(status, true);
    });

    await waitFor(() => {
      expect(deleteExecute).toHaveBeenCalledWith(status.info_hash, true);
      expect(toast.success).toHaveBeenCalledWith("已删除任务");
      expect(result.current.visibleTorrents).toHaveLength(0);
      expect(result.current.pendingDeleteHash).toBeNull();
    });
  });

  it("删除失败应该提示错误", async () => {
    const status = makeStatus();
    const deleteExecute = vi.fn().mockRejectedValue("Delete failed");
    const { result } = renderHook(
      () =>
        useDownloadsData(
          { torrents: [status] },
          makeDeps({ deleteTorrentUseCase: { execute: deleteExecute } }),
        ),
      { wrapper: MemoryRouter },
    );

    await act(async () => {
      result.current.handleDelete(status, false);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("删除任务失败"),
      );
      expect(result.current.pendingDeleteHash).toBeNull();
    });
  });

  it("删除执行中应该设置 pending 状态与 loading", async () => {
    let resolveDelete!: (value: undefined) => void;
    const deletePromise = new Promise<undefined>((res) => {
      resolveDelete = res;
    });
    const deleteExecute = vi.fn().mockImplementation(() => deletePromise);
    const status = makeStatus();
    const { result } = renderHook(
      () =>
        useDownloadsData(
          { torrents: [status] },
          makeDeps({ deleteTorrentUseCase: { execute: deleteExecute } }),
        ),
      { wrapper: MemoryRouter },
    );

    act(() => {
      result.current.handleDelete(status, false);
    });

    expect(result.current.pendingDeleteHash).toBe(status.info_hash);
    expect(result.current.delLoading).toBe(true);

    await act(async () => {
      resolveDelete(undefined);
      await deletePromise;
    });

    expect(result.current.pendingDeleteHash).toBeNull();
    expect(result.current.delLoading).toBe(false);
  });
});

describe("useDownloadsData 查看文件导航", () => {
  function ViewFilesProbe({
    torrent,
    deps,
  }: {
    torrent: TorrentStatusInfo;
    deps: UseDownloadsDataDeps;
  }) {
    const { handleViewFiles } = useDownloadsData({ torrents: [torrent] }, deps);
    const location = useLocation();
    return (
      <div>
        <button type="button" onClick={() => handleViewFiles(torrent)}>
          查看文件
        </button>
        <span>{location.pathname + location.search}</span>
      </div>
    );
  }

  it("点击查看文件应该跳转到 torrent 路由并携带参数", async () => {
    const status = makeStatus();
    render(
      <MemoryRouter initialEntries={["/downloads"]}>
        <ViewFilesProbe torrent={status} deps={makeDeps()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "查看文件" }));

    await waitFor(() => {
      expect(screen.getByText("/torrent?infoHash=hash123")).toBeInTheDocument();
    });
  });
});
