import { beforeEach, describe, expect, it, vi } from "vitest";
import { TauriTorrentRepository } from "./TauriTorrentRepository";

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => {
  class MockChannel {
    handler: (data: unknown) => void;
    constructor(handler: (data: unknown) => void) {
      this.handler = handler;
    }
  }
  return {
    invoke: mockInvoke,
    Channel: MockChannel,
  };
});

describe("TauriTorrentRepository 订阅测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribeTorrents 应该调用 torrent_subscribe 并注册 Channel 回调", async () => {
    const repo = new TauriTorrentRepository();
    const onUpdate = vi.fn();

    const unsub = await repo.subscribeTorrents(onUpdate);

    // 验证 invoke 被调用，且只传 onEvent 参数
    expect(mockInvoke).toHaveBeenCalledWith("torrent_subscribe", {
      onEvent: expect.any(Object),
    });

    expect(unsub).toBeTypeOf("function");
  });

  it("返回的 unsubscribe 函数应为 no-op，不再调用 torrent_unsubscribe", async () => {
    const repo = new TauriTorrentRepository();
    const onUpdate = vi.fn();

    const unsub = await repo.subscribeTorrents(onUpdate);
    vi.clearAllMocks();

    // 调用取消订阅（no-op）
    unsub();

    // 不应再调用任何 invoke
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
