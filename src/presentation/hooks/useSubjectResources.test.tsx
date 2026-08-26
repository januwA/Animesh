import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type { UseSubjectResourcesDeps } from "@/presentation/hooks/useSubjectResources";
import { useSubjectResources } from "@/presentation/hooks/useSubjectResources";

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
  overrides: Partial<UseSubjectResourcesDeps> = {},
): UseSubjectResourcesDeps => ({
  setTorrentSubjectUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
  clearTorrentSubjectUseCase: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
  ...overrides,
});

const renderResources = (
  deps: UseSubjectResourcesDeps,
  torrents: TorrentStatusInfo[] = [],
) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={["/subject/123"]}>{children}</MemoryRouter>
  );
  const hook = renderHook(
    () =>
      useSubjectResources(
        {
          subjectId: 123,
          platform: "bangumi",
          torrents,
          subjectName: "测试动漫",
        },
        deps,
      ),
    { wrapper },
  );
  return { result: hook.result, deps };
};

describe("useSubjectResources 资源绑定 hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该拆分已绑定/未绑定资源并统计数量", () => {
    const torrents = [
      makeTorrent({ subject_id: 123 }),
      makeTorrent({ info_hash: NonEmptyStringSchema.parse("hash-2") }),
    ];
    const { result } = renderResources(makeDeps(), torrents);

    expect(result.current.boundResourcesCount).toBe(1);
    expect(result.current.boundTorrents).toHaveLength(1);
    expect(result.current.unboundTorrents).toHaveLength(1);
  });

  it("绑定资源成功时应该调用 setTorrentSubjectUseCase 并提示成功", async () => {
    const deps = makeDeps();
    const { result } = renderResources(deps);

    await act(async () => {
      await result.current.handleBind("hash-1");
    });
    expect(deps.setTorrentSubjectUseCase.execute).toHaveBeenCalledWith({
      infoHash: NonEmptyStringSchema.parse("hash-1"),
      subjectId: 123,
      platform: "bangumi",
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
    const { result } = renderResources(deps);

    await act(async () => {
      await result.current.handleBind("hash-1");
    });
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("绑定失败: Bind failed"),
    );
  });

  it("解绑资源时应该调用 clearTorrentSubjectUseCase", async () => {
    const deps = makeDeps();
    const { result } = renderResources(deps);

    await act(async () => {
      await result.current.handleUnbind(NonEmptyStringSchema.parse("hash-1"));
    });
    expect(deps.clearTorrentSubjectUseCase.execute).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("hash-1"),
      "bangumi",
    );
    expect(toast.success).toHaveBeenCalledWith("已解除绑定");
  });

  it("解绑资源失败时应该显示错误提示", async () => {
    const deps = makeDeps({
      clearTorrentSubjectUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("解绑失败")),
      },
    });
    const { result } = renderResources(deps);

    await act(async () => {
      try {
        await result.current.handleUnbind(NonEmptyStringSchema.parse("hash-1"));
      } catch {
        // 忽略错误
      }
    });
    expect(toast.error).toHaveBeenCalledWith("解绑失败: 解绑失败");
  });
});
