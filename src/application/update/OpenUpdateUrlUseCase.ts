import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { UpdateRepository } from "../../domain/update/UpdateRepository";

export class OpenUpdateUrlUseCase {
  constructor(private updateRepository: UpdateRepository) {}

  async execute(url: NonEmptyString): Promise<void> {
    return this.updateRepository.openUrl(url);
  }
}
