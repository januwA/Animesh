import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	globFiles,
	isSourceFile,
	isTestFile,
	keyName,
	offsetToLoc,
	runChecks,
	traverse,
} from "./check-utils";

const FIXTURES = path.resolve(process.cwd(), "scripts/.tmp-fixtures");

function fixture(...parts: string[]): string {
	return path.join(FIXTURES, ...parts);
}

const originalArgv = process.argv;
const originalExit = process.exit;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeEach(() => {
	fs.mkdirSync(FIXTURES, { recursive: true });
});

afterEach(() => {
	process.argv = originalArgv;
	process.exit = originalExit;
	console.error = originalConsoleError;
	console.warn = originalConsoleWarn;
	console.log = originalConsoleLog;
	fs.rmSync(FIXTURES, { recursive: true, force: true });
	vi.restoreAllMocks();
});

function setupCli(args: string[], files: Record<string, string>): void {
	for (const [rel, content] of Object.entries(files)) {
		const abs = fixture(rel);
		fs.mkdirSync(path.dirname(abs), { recursive: true });
		fs.writeFileSync(abs, content, "utf8");
	}
	process.argv = ["tsx", "check-utils.ts", ...args];
}

describe("offsetToLoc 偏移量转行列", () => {
	it("空字符串定位到 1:1", () => {
		expect(offsetToLoc("", 0)).toEqual({ line: 1, column: 1 });
	});

	it("跨越多行时行号递增", () => {
		const src = "ab\ncd\nef";
		expect(offsetToLoc(src, 0)).toEqual({ line: 1, column: 1 });
		expect(offsetToLoc(src, 5)).toEqual({ line: 2, column: 3 });
		expect(offsetToLoc(src, 8)).toEqual({ line: 3, column: 3 });
	});
});

describe("traverse 树遍历", () => {
	it("访问所有节点并携带父级与祖父级", () => {
		const node = { type: "Root", child: { type: "Mid", leaf: { type: "Leaf" } } };
		const seen: string[] = [];
		traverse(node, (n, parent, grandparent) => {
			seen.push(
				`${n.type}:${parent ? parent.type : "-"}:${grandparent ? grandparent.type : "-"}`,
			);
		});
		expect(seen).toContain("Root:-:-");
		expect(seen).toContain("Mid:Root:-");
		expect(seen).toContain("Leaf:Mid:Root");
	});
});

describe("keyName 键名解析", () => {
	it("标识符键返回名称", () => {
		expect(keyName({ type: "Identifier", name: "foo" })).toBe("foo");
	});

	it("字符串字面量键返回值", () => {
		expect(keyName({ type: "Literal", value: "bar" })).toBe("bar");
	});

	it("未知键返回 null", () => {
		expect(keyName(null)).toBeNull();
		expect(keyName({ type: "ComputedPropertyName" })).toBeNull();
	});
});

describe("isSourceFile / isTestFile 文件类型判定", () => {
	it("源文件为真、测试文件为假", () => {
		expect(isSourceFile("useFoo.ts")).toBe(true);
		expect(isSourceFile("useFoo.test.tsx")).toBe(false);
	});

	it("测试文件判定正确", () => {
		expect(isTestFile("useFoo.test.ts")).toBe(true);
		expect(isTestFile("Foo.spec.tsx")).toBe(true);
		expect(isTestFile("useFoo.ts")).toBe(false);
	});
});

describe("globFiles 递归收集", () => {
	it("默认排除测试文件", () => {
		setupCli([], {
			"a/foo.ts": "const a = 1;",
			"a/foo.test.ts": "describe('x', () => {});",
			"b/bar.tsx": "const b = 1;",
		});
		const files = globFiles(FIXTURES);
		expect(files.map((f) => path.relative(FIXTURES, f).split(path.sep).join("/")).sort()).toEqual([
			"a/foo.ts",
			"b/bar.tsx",
		]);
	});

	it("includeTests 时包含测试文件", () => {
		setupCli([], {
			"a/foo.test.ts": "describe('x', () => {});",
		});
		const files = globFiles(FIXTURES, { includeTests: true });
		expect(files.map((f) => path.relative(FIXTURES, f).split(path.sep).join("/"))).toEqual(["a/foo.test.ts"]);
	});

	it("ignore 回调可过滤文件", () => {
		setupCli([], {
			"ui/button.tsx": "const a = 1;",
			"app/foo.ts": "const a = 1;",
		});
		const files = globFiles(FIXTURES, {
			ignore: (f) => path.relative(FIXTURES, f).startsWith("ui"),
		});
		expect(files.map((f) => path.relative(FIXTURES, f).split(path.sep).join("/"))).toEqual(["app/foo.ts"]);
	});
});

describe("runChecks 多规则 CLI runner", () => {
	it("传入文件参数时仅检查匹配的文件，且不匹配时不再全量回退", () => {
		setupCli(["not-exists-file.ts"], {
			"bad/useFoo.ts": "export function useFoo() { return { a1,a2 }; }",
		});
		const exitCode = vi.fn();
		vi.spyOn(process, "exit").mockImplementation(((code: number) => {
			exitCode(code);
			throw new Error(`exit ${code}`);
		}) as never);
		console.log = vi.fn();
		console.error = vi.fn();

		expect(() =>
			runChecks("测试", [
				{
					name: "规则A",
					targetDirs: ["scripts/.tmp-fixtures/bad"],
					check: () => [],
				},
			]),
		).toThrow("exit 0");
	});

	it("存在 error 违规时输出规则名并退出 1", () => {
		setupCli([], {
			"bad/useFoo.ts": "export function useFoo() { return { a1,a2 }; }",
		});
		const exitCode = vi.fn();
		vi.spyOn(process, "exit").mockImplementation(((code: number) => {
			exitCode(code);
			throw new Error(`exit ${code}`);
		}) as never);
		console.log = vi.fn();
		console.error = vi.fn();

		expect(() =>
			runChecks("测试", [
				{
					name: "大小检查",
					targetDirs: ["scripts/.tmp-fixtures/bad"],
					check: () => [{ line: 1, column: 1, severity: "error", message: "过大" }],
				},
			]),
		).toThrow("exit 1");
		expect(exitCode).toHaveBeenCalledWith(1);
		const errorCalls = vi.mocked(console.error).mock.calls.map((c) => c.join(""));
		expect(errorCalls.some((c) => c.includes("[大小检查]"))).toBe(true);
		expect(errorCalls.some((c) => c.includes("useFoo.ts:1:1"))).toBe(true);
	});

	it("仅 warning 违规时退出 0", () => {
		setupCli([], {
			"ok/useFoo.ts": "export function useFoo() { return { a1,a2 }; }",
		});
		const exitCode = vi.fn();
		vi.spyOn(process, "exit").mockImplementation(((code: number) => {
			exitCode(code);
			throw new Error(`exit ${code}`);
		}) as never);
		console.log = vi.fn();
		console.warn = vi.fn();
		console.error = vi.fn();

		expect(() =>
			runChecks("测试", [
				{
					name: "警告规则",
					targetDirs: ["scripts/.tmp-fixtures/ok"],
					check: () => [{ line: 1, column: 1, severity: "warning", message: "提示" }],
				},
			]),
		).toThrow("exit 0");
		expect(exitCode).toHaveBeenCalledWith(0);
		expect(vi.mocked(console.warn).mock.calls.some((c) => c.join("").includes("[警告规则]"))).toBe(true);
	});

	it("多个规则各自过滤目标目录与文件类型", () => {
		setupCli([], {
			"app/useFoo.ts": "const a = 1;",
			"app/foo.test.ts": "describe('x', () => {});",
			"ui/useBar.ts": "const b = 1;",
		});
		const exitCode = vi.fn();
		vi.spyOn(process, "exit").mockImplementation(((code: number) => {
			exitCode(code);
			throw new Error(`exit ${code}`);
		}) as never);
		console.log = vi.fn();
		console.error = vi.fn();

		const seen: string[] = [];
		expect(() =>
			runChecks("测试", [
				{
					name: "源文件规则",
					targetDirs: ["scripts/.tmp-fixtures/app"],
					check: (_code, filepath) => {
						seen.push(`src:${path.relative(FIXTURES, filepath).split(path.sep).join("/")}`);
						return [];
					},
				},
				{
					name: "测试文件规则",
					targetDirs: ["scripts/.tmp-fixtures/app"],
					includeFile: (f) => isTestFile(f),
					check: (_code, filepath) => {
						seen.push(`test:${path.relative(FIXTURES, filepath).split(path.sep).join("/")}`);
						return [];
					},
				},
				{
					name: "ui 目录规则",
					targetDirs: ["scripts/.tmp-fixtures/ui"],
					check: (_code, filepath) => {
						seen.push(`ui:${path.relative(FIXTURES, filepath).split(path.sep).join("/")}`);
						return [];
					},
				},
			]),
		).toThrow("exit 0");
		expect(seen).toEqual(["src:app/useFoo.ts", "test:app/foo.test.ts", "ui:ui/useBar.ts"]);
	});

	it("check 抛异常时转为解析失败错误并退出 1", () => {
		setupCli([], {
			"app/foo.ts": "const a = 1;",
		});
		const exitCode = vi.fn();
		vi.spyOn(process, "exit").mockImplementation(((code: number) => {
			exitCode(code);
			throw new Error(`exit ${code}`);
		}) as never);
		console.log = vi.fn();
		console.error = vi.fn();

		expect(() =>
			runChecks("测试", [
				{
					name: "规则A",
					targetDirs: ["scripts/.tmp-fixtures/app"],
					check: () => {
						throw new Error("bad syntax");
					},
				},
			]),
		).toThrow("exit 1");
		const errorCalls = vi.mocked(console.error).mock.calls.map((c) => c.join(""));
		expect(errorCalls.some((c) => c.includes("解析失败") && c.includes("bad syntax"))).toBe(true);
	});
});