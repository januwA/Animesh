import type { UpdateRepository } from "../../domain/update/UpdateRepository";

export class OpenUpdateUrlUseCase {
	constructor(private updateRepository: UpdateRepository) {}

	async execute(url: string): Promise<void> {
		if (!url) {
			throw new Error("URL 不能为空");
		}
		return this.updateRepository.openUrl(url);
	}
}
