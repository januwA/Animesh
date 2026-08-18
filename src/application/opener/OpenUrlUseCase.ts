import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { OpenerRepository } from "../../domain/opener/OpenerRepository";

export class OpenUrlUseCase {
  constructor(private openerRepository: OpenerRepository) {}

  async execute(url: NonEmptyString): Promise<void> {
    return this.openerRepository.openUrl(url);
  }
}
