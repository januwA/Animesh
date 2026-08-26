import { act, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import {
  TorrentStatusProvider,
  useTorrentStatus,
} from "./TorrentStatusContext";

function makeTorrent(name: string): TorrentStatusInfo {
  return {
    info_hash: NonEmptyStringSchema.parse(`hash-${name}`),
    name: NonEmptyStringSchema.parse(name),
    progress_bytes: 100,
    total_bytes: 1000,
    finished: false,
    download_speed_bytes_per_sec: 0,
    upload_speed_bytes_per_sec: 0,
    paused: false,
    peers_connected: 0,
    peers_total: 0,
    trackers: [],
  };
}

function createStream(
  data: TorrentStatusInfo[],
): ReadableStream<TorrentStatusInfo[]> {
  return new ReadableStream<TorrentStatusInfo[]>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

function StatusConsumer() {
  const { torrents, isLoading } = useTorrentStatus();
  return (
    <div>
      <span data-testid="status-count">{torrents.length}</span>
      <span data-testid="status-loading">{String(isLoading)}</span>
      <span data-testid="status-names">
        {torrents.map((t) => t.name).join(",")}
      </span>
    </div>
  );
}

const renderProvider = (
  container: DIContainer,
  children = <StatusConsumer />,
) =>
  render(
    <DIProvider value={container}>
      <TorrentStatusProvider>{children}</TorrentStatusProvider>
    </DIProvider>,
  );

const mockNotifyDownloadCompletionUseCase = { execute: vi.fn() };

function createContainer(overrides: Record<string, unknown> = {}): DIContainer {
  return {
    notifyDownloadCompletionUseCase: mockNotifyDownloadCompletionUseCase,
    ...overrides,
  } as unknown as DIContainer;
}

describe("TorrentStatusContext 种子状态上下文", () => {
  it("未提供 Provider 时 useTorrentStatus 返回默认空状态", () => {
    function DefaultConsumer() {
      const { torrents, isLoading } = useTorrentStatus();
      return (
        <div>
          <span data-testid="default-count">{torrents.length}</span>
          <span data-testid="default-loading">{String(isLoading)}</span>
        </div>
      );
    }

    render(<DefaultConsumer />);

    expect(screen.getByTestId("default-count")).toHaveTextContent("0");
    expect(screen.getByTestId("default-loading")).toHaveTextContent("true");
  });

  it("订阅成功后应把种子列表提供给消费者", async () => {
    const subscribe = vi
      .fn()
      .mockResolvedValue(createStream([makeTorrent("xxx")]));
    renderProvider(
      createContainer({
        subscribeTorrentsUseCase: { execute: subscribe },
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("status-count")).toHaveTextContent("1");
    });
    expect(screen.getByTestId("status-loading")).toHaveTextContent("false");
    expect(screen.getByTestId("status-names")).toHaveTextContent("xxx");
  });

  it("订阅失败时应提示错误并结束加载状态", async () => {
    const subscribe = vi.fn().mockRejectedValue(new Error("订阅失败"));
    renderProvider(
      createContainer({
        subscribeTorrentsUseCase: { execute: subscribe },
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("status-loading")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("status-count")).toHaveTextContent("0");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "获取下载列表失败: 订阅失败",
    );
  });

  it("卸载时应该调用取消订阅函数", async () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn().mockImplementation(() => {
      const stream = new ReadableStream<TorrentStatusInfo[]>({
        start(controller) {
          controller.enqueue([]);
        },
        cancel() {
          unsubscribe();
        },
      });
      return Promise.resolve(stream);
    });
    const view = renderProvider(
      createContainer({
        subscribeTorrentsUseCase: { execute: subscribe },
      }),
    );

    await waitFor(() => {
      expect(subscribe).toHaveBeenCalled();
    });
    act(() => view.unmount());

    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});
