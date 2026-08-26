import type { NonEmptyString } from "../common/NonEmptyString";

export interface OpenerRepository {
  openUrl(url: NonEmptyString): Promise<void>;
}
