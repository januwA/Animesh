import { getVersion } from "@tauri-apps/api/app";
import type { OpenerRepository } from "../../domain/opener/OpenerRepository";
import type { UpdateInfo } from "../../domain/update/UpdateInfo";
import type { UpdateRepository } from "../../domain/update/UpdateRepository";

export class GithubUpdateRepository implements UpdateRepository {
	constructor(private readonly openerRepository: OpenerRepository) {}
	private readonly githubApiUrl =
		"https://api.github.com/repos/januwA/Animesh/releases/latest";

	async getLatestRelease(): Promise<UpdateInfo> {
		try {
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

			const data = (await response.json()) as {
				tag_name: string;
				body: string;
				published_at: string;
				html_url: string;
				assets: Array<{
					name: string;
					browser_download_url: string;
				}>;
			};

			const installerAsset = data.assets.find(
				(asset) =>
					asset.name.endsWith(".msi") ||
					asset.name.endsWith(".exe") ||
					asset.name.endsWith(".dmg") ||
					asset.name.endsWith(".deb") ||
					asset.name.endsWith(".apk"),
			);

			return {
				version: data.tag_name,
				notes: data.body,
				pubDate: data.published_at,
				url: installerAsset?.browser_download_url,
				htmlUrl: data.html_url,
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
