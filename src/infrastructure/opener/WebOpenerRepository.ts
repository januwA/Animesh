import type { OpenerRepository } from "../../domain/opener/OpenerRepository";

export class WebOpenerRepository implements OpenerRepository {
	async openUrl(url: string): Promise<void> {
		try {
			window.open(url, "_blank");
		} catch (err: unknown) {
			throw new Error("打开链接失败", { cause: err });
		}
	}
}
