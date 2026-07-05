import { describe, expect, it } from "vitest";
import { parseSemver, compareSemver } from "./bump-version";

describe("版本号升级工具", () => {
	describe("版本号解析 (parseSemver)", () => {
		it("应该正确解析标准的 SemVer 版本号", () => {
			expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, pre: undefined });
			expect(parseSemver("0.1.0-alpha.1")).toEqual({ major: 0, minor: 1, patch: 0, pre: "alpha.1" });
		});

		it("解析无效的版本号格式时应该抛出错误", () => {
			expect(() => parseSemver("1.2")).toThrow("无效的版本号格式");
			expect(() => parseSemver("a.b.c")).toThrow("无效的版本号格式");
		});
	});

	describe("版本号对比 (compareSemver)", () => {
		it("当两个版本号相同时应该返回 0", () => {
			expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
		});

		it("当第一个版本号较大时应该返回大于 0 的值", () => {
			expect(compareSemver("1.2.4", "1.2.3")).toBeGreaterThan(0);
			expect(compareSemver("1.3.0", "1.2.3")).toBeGreaterThan(0);
			expect(compareSemver("2.0.0", "1.2.3")).toBeGreaterThan(0);
			expect(compareSemver("1.2.3", "1.2.3-alpha.1")).toBeGreaterThan(0);
		});

		it("当第一个版本号较小时应该返回小于 0 的值", () => {
			expect(compareSemver("1.2.2", "1.2.3")).toBeLessThan(0);
			expect(compareSemver("1.1.9", "1.2.3")).toBeLessThan(0);
			expect(compareSemver("0.9.9", "1.2.3")).toBeLessThan(0);
			expect(compareSemver("1.2.3-alpha.1", "1.2.3")).toBeLessThan(0);
		});
	});
});
