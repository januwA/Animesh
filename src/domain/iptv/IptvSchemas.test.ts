import { describe, expect, it } from "vitest";
import { IptvChannelSchema, IptvCountriesResponseSchema } from "./IptvSchemas";

describe("IptvCountriesResponseSchema", () => {
	it("应该解析合法的国家列表数据", () => {
		const raw = [
			{ name: "China", code: "CN", flag: "🇨🇳", languages: ["zho"] },
			{ name: "Japan", code: "JP", flag: "🇯🇵" },
		];

		const result = IptvCountriesResponseSchema.safeParse(raw);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).toHaveLength(2);
		expect(result.data[0].code).toBe("CN");
		expect(result.data[1].languages).toBeUndefined();
	});

	it("缺少 code 或 flag 时应该解析失败", () => {
		const invalid = [{ name: "China" }];
		expect(IptvCountriesResponseSchema.safeParse(invalid).success).toBe(false);
	});
});

describe("IptvChannelSchema", () => {
	it("应该解析包含可选字段的频道数据", () => {
		const raw = {
			tvgId: "CCTV1.cn@HD",
			name: "CCTV-1 (1080p)",
			logo: "https://example.com/logo.png",
			category: "General",
			url: "https://example.com/stream.m3u8",
		};

		const result = IptvChannelSchema.safeParse(raw);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.name).toBe("CCTV-1 (1080p)");
	});

	it("没有可选字段时应该使用默认值", () => {
		const raw = { name: "Channel", url: "https://example.com/a.m3u8" };

		const result = IptvChannelSchema.safeParse(raw);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.tvgId).toBeUndefined();
		expect(result.data.logo).toBeUndefined();
	});

	it("缺少 url 或 name 时应该解析失败", () => {
		expect(IptvChannelSchema.safeParse({ name: "x" }).success).toBe(false);
		expect(
			IptvChannelSchema.safeParse({ url: "https://x.com/a.m3u8" }).success,
		).toBe(false);
	});
});
