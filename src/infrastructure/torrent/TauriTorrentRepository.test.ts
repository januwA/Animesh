import { beforeEach, describe, expect, it, vi } from "vitest";
import { TauriTorrentRepository } from "./TauriTorrentRepository";

const { mockInvoke } = vi.hoisted(() => ({
	mockInvoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => {
	class MockChannel {
		handler: (data: any) => void;
		constructor(handler: (data: any) => void) {
			this.handler = handler;
		}
	}
	return {
		invoke: mockInvoke,
		Channel: MockChannel,
	};
});

describe("TauriTorrentRepository 订阅与取消订阅测试", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("subscribeTorrents 应该在调用时传入 subscriptionId 和 sessionId，并注册回调", async () => {
		const repo = new TauriTorrentRepository();
		const onUpdate = vi.fn();

		const unsub = await repo.subscribeTorrents(onUpdate);

		// 验证 invoke 被调用，并且参数正确
		expect(mockInvoke).toHaveBeenCalledWith(
			"torrent_subscribe",
			expect.objectContaining({
				subscriptionId: expect.any(String),
				sessionId: expect.any(String),
				onEvent: expect.any(Object),
			}),
		);

		expect(unsub).toBeTypeOf("function");
	});

	it("调用返回的 unsubscribe 函数应该触发 torrent_unsubscribe", async () => {
		const repo = new TauriTorrentRepository();
		const onUpdate = vi.fn();

		const unsub = await repo.subscribeTorrents(onUpdate);

		// 获取传给 invoke 的 subscriptionId
		const calls = mockInvoke.mock.calls;
		const subscribeCall = calls.find((call) => call[0] === "torrent_subscribe");
		expect(subscribeCall).toBeDefined();
		const subscriptionId = subscribeCall![1].subscriptionId;

		// 调用取消订阅
		await unsub();

		// 验证 invoke 调用了 torrent_unsubscribe
		expect(mockInvoke).toHaveBeenCalledWith("torrent_unsubscribe", {
			subscriptionId,
		});
	});
});
