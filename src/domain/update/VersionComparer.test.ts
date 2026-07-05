import { describe, expect, it } from "vitest";
import { compareVersions } from "./VersionComparer";

describe("VersionComparer 单元测试", () => {
	it("应该正确判断两个版本号的大小", () => {
		expect(compareVersions("0.3.1", "0.3.2")).toBe(-1);
		expect(compareVersions("0.3.1", "0.3.1")).toBe(0);
		expect(compareVersions("0.4.0", "0.3.9")).toBe(1);
	});

	it("应该容忍版本号中带有的 v 前缀", () => {
		expect(compareVersions("v0.3.1", "0.3.2")).toBe(-1);
		expect(compareVersions("0.3.1", "v0.3.1")).toBe(0);
		expect(compareVersions("v0.4.0", "v0.3.9")).toBe(1);
	});

	it("应该正确处理版本号分段长度不一致的情况", () => {
		expect(compareVersions("1.0", "1.0.1")).toBe(-1);
		expect(compareVersions("1.0.0", "1.0")).toBe(0);
		expect(compareVersions("1", "1.0.0")).toBe(0);
		expect(compareVersions("2.0.0", "1")).toBe(1);
	});

	it("应该容忍非数字版本段的字符串比较", () => {
		expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
	});
});
