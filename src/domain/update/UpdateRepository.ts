import type { NonEmptyString } from "../common/NonEmptyString";
import type { UpdateInfo } from "./UpdateInfo";

export interface UpdateRepository {
  getLatestRelease(): Promise<UpdateInfo>;
  getCurrentVersion(): Promise<string>;
  openUrl(url: NonEmptyString): Promise<void>;
}
