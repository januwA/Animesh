import { z } from "zod";

export const GithubAssetSchema = z.object({
	name: z.string(),
	browser_download_url: z.string().url(),
});

export const GithubReleaseSchema = z.object({
	tag_name: z.string().min(1),
	body: z
		.string()
		.nullable()
		.optional()
		.transform((val) => val ?? ""),
	published_at: z
		.string()
		.nullable()
		.optional()
		.transform((val) => val ?? ""),
	assets: z
		.array(GithubAssetSchema)
		.nullable()
		.optional()
		.transform((val) => val ?? []),
	html_url: z.string().url(),
});

export type GithubRelease = z.infer<typeof GithubReleaseSchema>;
export type GithubAsset = z.infer<typeof GithubAssetSchema>;
