import { describe, expect, it } from "vitest";
import { formatBytes, formatError, formatLocalDate } from "./utils";

describe("格式化字节大小函数 formatBytes", () => {
	it("应该正确格式化字节数为可读字符串", () => {
		expect(formatBytes(null)).toBe("未知大小");
		expect(formatBytes(undefined)).toBe("未知大小");
		expect(formatBytes(0)).toBe("未知大小");
		expect(formatBytes(512)).toBe("512 B");
		expect(formatBytes(1024)).toBe("1 KB");
		expect(formatBytes(1536)).toBe("1.5 KB");
		expect(formatBytes(1048576)).toBe("1 MB");
		expect(formatBytes(1073741824)).toBe("1 GB");
	});
});

describe("格式化本地时间函数 formatLocalDate", () => {
	it("应该正确将符合规范的日期字符串格式化为本地时间字符串 YYYY-MM-DD HH:mm:ss", () => {
		const input = "Mon, 23 Jun 2026 12:00:00 +0800";
		const result = formatLocalDate(input);

		expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

		const expectedDate = new Date(input);
		const pad = (n: number) => String(n).padStart(2, "0");
		const expectedStr = `${expectedDate.getFullYear()}-${pad(
			expectedDate.getMonth() + 1,
		)}-${pad(expectedDate.getDate())} ${pad(expectedDate.getHours())}:${pad(
			expectedDate.getMinutes(),
		)}:${pad(expectedDate.getSeconds())}`;

		expect(result).toBe(expectedStr);
	});

	it("当输入空字符串或无效日期时，应该原样返回或返回空", () => {
		expect(formatLocalDate("")).toBe("");
		expect(formatLocalDate("invalid-date")).toBe("invalid-date");
	});
});

describe("格式化错误对象函数 formatError", () => {
	it("应该正确处理非 Error 类型的错误", () => {
		expect(formatError("网络连接失败")).toBe("网络连接失败");
		expect(formatError(404)).toBe("404");
		expect(formatError(null)).toBe("null");
		expect(formatError(undefined)).toBe("undefined");
	});

	it("应该正确处理普通 Error 对象", () => {
		const err = new Error("请求超时");
		expect(formatError(err)).toBe("请求超时");
	});

	it("应该正确处理带有单层 cause 的 Error 对象", () => {
		const cause = new Error("连接重置");
		const err = new Error("请求失败", { cause });
		expect(formatError(err)).toBe("请求失败 -> 连接重置");
	});

	it("应该正确处理带有嵌套多层 cause 的 Error 对象", () => {
		const causeOfCause = new Error("DNS 解析失败");
		const cause = new Error("无法连接到服务器", { cause: causeOfCause });
		const err = new Error("初始化失败", { cause });
		expect(formatError(err)).toBe(
			"初始化失败 -> 无法连接到服务器 -> DNS 解析失败",
		);
	});

	it("应该正确处理 cause 为非 Error 类型的情况", () => {
		const err = new Error("读取文件失败", { cause: "文件不存在" });
		expect(formatError(err)).toBe("读取文件失败 -> 文件不存在");
	});
});
