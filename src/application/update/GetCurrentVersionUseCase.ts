import type { UpdateRepository } from "../../domain/update/UpdateRepository";

export class GetCurrentVersionUseCase {
	constructor(private updateRepository: UpdateRepository) {}

	execute(): Promise<string> {
		return this.updateRepository.getCurrentVersion();
	}
}
