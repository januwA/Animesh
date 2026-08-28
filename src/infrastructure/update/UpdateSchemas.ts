import { z } from "zod";

export const GithubAssetSchema = z.object({
  name: z.string(),
  browser_download_url: z.url(),
});

export const GithubReleaseSchema = z.object({
  tag_name: z.string().min(1),
  body: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  assets: z.array(GithubAssetSchema).nullable().optional(),
  html_url: z.url(),
});

export type GithubRelease = z.infer<typeof GithubReleaseSchema>;
