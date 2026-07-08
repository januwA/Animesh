import type { OpenerRepository } from "../../domain/opener/OpenerRepository";

export class TauriOpenerRepository implements OpenerRepository {
	async openUrl(url: string): Promise<void> {
		try {
			const { openUrl } = await import("@tauri-apps/plugin-opener");
			await openUrl(url);
		} catch (err: unknown) {
			let fallbackSuccess = false;
			try {
				window.open(url, "_blank");
				fallbackSuccess = true;
			} catch (fallbackErr: unknown) {
				throw new Error("打开链接失败", { cause: fallbackErr });
			}

			if (!fallbackSuccess) {
				throw err;
			}
		}
	}
}
