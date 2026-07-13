import { getVersion } from "@tauri-apps/api/app";
import type { OpenerRepository } from "../../domain/opener/OpenerRepository";
import type { UpdateInfo } from "../../domain/update/UpdateInfo";
import type { UpdateRepository } from "../../domain/update/UpdateRepository";
import {
	type GithubRelease,
	GithubReleaseSchema,
} from "../../domain/update/UpdateSchemas";

export class GithubUpdateRepository implements UpdateRepository {
	constructor(private readonly openerRepository: OpenerRepository) {}
	private readonly githubApiUrl =
		"https://api.github.com/repos/januwA/Animesh/releases/latest";

	private async fetchLatestReleaseData(): Promise<unknown> {
		const response = await fetch(this.githubApiUrl, {
			headers: {
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "Animesh-App",
			},
		});

		if (!response.ok) {
			throw new Error(
				`GitHub API 请求失败: HTTP ${response.status} ${response.statusText}`,
			);
		}

		const rawJson = await response.json();
		const result = GithubReleaseSchema.safeParse(rawJson);
		if (!result.success) {
			throw new Error("GitHub API 返回的数据结构不匹配", {
				cause: result.error,
			});
		}
		return result.data;
	}

	private findInstallerUrl(
		assets: Array<{ name: string; browser_download_url: string }>,
	): string | undefined {
		const asset = assets.find(
			(a) =>
				a.name.endsWith(".msi") ||
				a.name.endsWith(".exe") ||
				a.name.endsWith(".dmg") ||
				a.name.endsWith(".deb") ||
				a.name.endsWith(".apk"),
		);
		return asset?.browser_download_url;
	}

	async getLatestRelease(): Promise<UpdateInfo> {
		try {
			const data = await this.fetchLatestReleaseData();
			const release = data as GithubRelease;

			return {
				version: release.tag_name,
				notes: release.body,
				pubDate: release.published_at,
				url: this.findInstallerUrl(release.assets),
				htmlUrl: release.html_url,
			};
		} catch (err: unknown) {
			throw new Error("获取 GitHub 最新发布版本失败", { cause: err });
		}
	}

	async getCurrentVersion(): Promise<string> {
		try {
			return await getVersion();
		} catch (err: unknown) {
			throw new Error("获取当前应用版本失败", { cause: err });
		}
	}

	async openUrl(url: string): Promise<void> {
		return this.openerRepository.openUrl(url);
	}
}
