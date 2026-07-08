import type { OpenerRepository } from "../../domain/opener/OpenerRepository";

export class OpenUrlUseCase {
	constructor(private openerRepository: OpenerRepository) {}

	async execute(url: string): Promise<void> {
		if (!url) {
			throw new Error("URL 不能为空");
		}
		return this.openerRepository.openUrl(url);
	}
}
