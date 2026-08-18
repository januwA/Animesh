import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { UpdateInfo } from "../../domain/update/UpdateInfo";
import type { UpdateRepository } from "../../domain/update/UpdateRepository";

export class WebUpdateRepository implements UpdateRepository {
  async getLatestRelease(): Promise<UpdateInfo> {
    throw new Error("Web 网页端不支持检查更新功能");
  }

  async getCurrentVersion(): Promise<string> {
    throw new Error("Web 网页端不支持获取应用版本功能");
  }

  async openUrl(url: NonEmptyString): Promise<void> {
    throw new Error(`Web 网页端不支持打开外部链接：${url}`);
  }
}
