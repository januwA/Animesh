import type { UpdateCheckResult } from "../../domain/update/UpdateInfo";
import type { UpdateRepository } from "../../domain/update/UpdateRepository";
import { compareVersions } from "../../domain/update/VersionComparer";

export class CheckUpdateUseCase {
	constructor(private updateRepository: UpdateRepository) {}

	async execute(): Promise<UpdateCheckResult> {
		try {
			const latestRelease = await this.updateRepository.getLatestRelease();
			const currentVersion = await this.updateRepository.getCurrentVersion();

			const comparison = compareVersions(latestRelease.version, currentVersion);
			const hasUpdate = comparison > 0;

			return {
				hasUpdate,
				latestVersion: latestRelease.version,
				currentVersion,
				notes: latestRelease.notes,
				url: latestRelease.url,
				htmlUrl: latestRelease.htmlUrl,
			};
		} catch (err: unknown) {
			// 处理错误应该一直向上抛，重新包装并抛出新错误时必须使用 { cause: err }
			throw new Error("检查更新失败", { cause: err });
		}
	}
}
