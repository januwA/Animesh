import { beforeEach, describe, expect, it, vi } from "vitest";
import { TauriOpenerRepository } from "./TauriOpenerRepository";

vi.mock("@tauri-apps/plugin-opener", () => ({
	openUrl: vi.fn(),
}));

describe("TauriOpenerRepository 单元测试", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(window, "open").mockImplementation(() => null as any);
	});

	it("应该成功调用 @tauri-apps/plugin-opener 的 openUrl 方法", async () => {
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		vi.mocked(openUrl).mockResolvedValueOnce(undefined);

		const repo = new TauriOpenerRepository();
		await repo.openUrl("https://example.com");

		expect(openUrl).toHaveBeenCalledWith("https://example.com");
	});

	it("当 Tauri Opener 插件调用失败时，应该降级使用 window.open", async () => {
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		vi.mocked(openUrl).mockRejectedValueOnce(new Error("Tauri error"));

		const repo = new TauriOpenerRepository();
		await repo.openUrl("https://example.com");

		expect(openUrl).toHaveBeenCalledWith("https://example.com");
		expect(window.open).toHaveBeenCalledWith("https://example.com", "_blank");
	});

	it("如果降级 window.open 也失败，应该抛出错误", async () => {
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		vi.mocked(openUrl).mockRejectedValueOnce(new Error("Tauri error"));
		vi.spyOn(window, "open").mockImplementationOnce(() => {
			throw new Error("window.open blocked");
		});

		const repo = new TauriOpenerRepository();
		await expect(repo.openUrl("https://example.com")).rejects.toThrow(
			"打开链接失败",
		);
	});
});
