import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface TestDiErrorLocation {
	line: number;
	column: number;
	severity: "error";
	message: string;
}

const PRESENTATION_DIR = "src/presentation";
const PAGES_DIR = "src/presentation/pages";
const CREATE_CONTAINER_IMPORT = "createDIContainerForTest";
const DIPROVIDER_IMPORT = "DIProvider";

function offsetToLoc(
	src: string,
	offset: number,
): { line: number; column: number } {
	let line = 1;
	let column = 1;
	for (let i = 0; i < offset; i++) {
		if (src[i] === "\n") {
			line++;
			column = 1;
		} else {
			column++;
		}
	}
	return { line, column };
}

function parseTs(
	code: string,
	filepath: string,
): ReturnType<typeof parseSync> {
	const ext = path.extname(filepath).slice(1);
	const lang = ["js", "jsx", "ts", "tsx"].includes(ext)
		? (ext as "js" | "jsx" | "ts" | "tsx")
		: "ts";

	const parseResult = parseSync(filepath, code, { lang });

	if (parseResult.errors && parseResult.errors.length > 0) {
		const errorMsg = parseResult.errors.map((e) => e.message).join("\n");
		throw new Error(`解析文件失败 ${filepath}:\n${errorMsg}`);
	}
	return parseResult;
}

function traverse(node: any, visit: (node: any) => void) {
	if (!node || typeof node !== "object") return;
	visit(node);
	for (const key in node) {
		if (Object.hasOwn(node, key)) {
			const child = node[key];
			if (Array.isArray(child)) {
				for (const item of child) {
					traverse(item, visit);
				}
			} else if (child && typeof child === "object") {
				traverse(child, visit);
			}
		}
	}
}

/** hook 级单测：文件名形如 useXxx.test.tsx */
export function isHookTestFile(filepath: string): boolean {
	const basename = path.posix.basename(filepath.replace(/\\/g, "/"));
	return /^use.+\.test\.[jt]sx?$/.test(basename);
}

/** 页面级集成测试候选：pages 目录下的 index.test.tsx */
export function isPageTestFile(filepath: string): boolean {
	const normalized = filepath.replace(/\\/g, "/");
	const basename = path.posix.basename(normalized);
	if (!/^index\.test\.[jt]sx?$/.test(basename)) return false;
	return normalized.includes(`/src/presentation/pages/`);
}

export function collectImportNames(program: any): Set<string> {
	const names = new Set<string>();
	traverse(program, (node) => {
		if (node.type !== "ImportDeclaration") return;
		for (const spec of node.specifiers ?? []) {
			if (
				spec.type === "ImportSpecifier" &&
				spec.imported?.type === "Identifier"
			) {
				names.add(spec.imported.name);
			}
		}
	});
	return names;
}

/** 检测是否包含 as ... as DIContainer 类型断言 */
export function hasDIContainerCast(program: any): boolean {
	let found = false;
	traverse(program, (node) => {
		if (found) return;
		if (node.type !== "TSAsExpression") return;
		const ann = node.typeAnnotation;
		if (
			ann?.type === "TSTypeReference" &&
			ann.typeName?.type === "Identifier" &&
			ann.typeName.name === "DIContainer"
		) {
			found = true;
		}
	});
	return found;
}

export interface TestDiCheckOptions {
	/** 同目录下是否存在组合根 index.tsx（页面测试候选需渲染组合根） */
	siblingUsesUseDI: boolean;
}

/**
 * 检查表现层测试的 DI 注入规范：
 * - hook 级单测（use*.test.*）不得使用 createDIContainerForTest，依赖应通过参数注入；
 * - 页面级集成测试（index.test.*）必须渲染 DIProvider 并使用
 *   value={mock as unknown as DIContainer} 注入最小 mock 容器，且不得使用 createDIContainerForTest。
 */
export function checkCode(
	code: string,
	filepath: string,
	options: TestDiCheckOptions = { siblingUsesUseDI: false },
): TestDiErrorLocation[] {
	const parseResult = parseTs(code, filepath);
	const program = parseResult.program;
	const imports = collectImportNames(program);
	const errors: TestDiErrorLocation[] = [];

	const report = (offset: number, message: string) => {
		const loc = offsetToLoc(code, offset);
		errors.push({ ...loc, severity: "error", message });
	};

	if (isHookTestFile(filepath)) {
		const importOffset = code.indexOf(CREATE_CONTAINER_IMPORT);
		if (imports.has(CREATE_CONTAINER_IMPORT)) {
			report(
				importOffset >= 0 ? importOffset : 0,
				`hook 级单测不得使用 createDIContainerForTest，hook 的 use case 依赖应通过参数直接注入 mock（{ execute: vi.fn() }），断言上移到 use case 的 execute 层。`,
			);
		}
	}

	if (isPageTestFile(filepath) && options.siblingUsesUseDI) {
		if (!imports.has(DIPROVIDER_IMPORT)) {
			report(
				code.indexOf("index") >= 0 ? 0 : 0,
				`页面级集成测试必须渲染组合根，并使用 <DIProvider value={mock as unknown as DIContainer}> 注入最小 mock 容器（需 import DIProvider）。`,
			);
		}
		if (!hasDIContainerCast(program)) {
			report(
				0,
				`页面级集成测试的 mock 容器必须通过 as unknown as DIContainer 断言构造，禁止依赖 createDIContainerForTest。`,
			);
		}
		if (imports.has(CREATE_CONTAINER_IMPORT)) {
			const importOffset = code.indexOf(CREATE_CONTAINER_IMPORT);
			report(
				importOffset >= 0 ? importOffset : 0,
				`页面级集成测试不得使用 createDIContainerForTest，应手写最小 mock 容器并显式列出组合根与所有子组件/Provider 消费的 key（如 TorrentStatusProvider 需要 subscribeTorrentsUseCase）。`,
			);
		}
	}

	return errors;
}

function globTestFiles(dir: string): string[] {
	const results: string[] = [];
	if (!fs.existsSync(dir)) return results;
	const list = fs.readdirSync(dir);
	for (const file of list) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat && stat.isDirectory()) {
			results.push(...globTestFiles(filePath));
		} else if (/\.(test|spec)\.[jt]sx?$/.test(file)) {
			results.push(filePath);
		}
	}
	return results;
}

function main() {
	const args = process.argv
		.slice(2)
		.flatMap((f) => f.split(/\s+/))
		.filter(Boolean);

	const targetDirs = [PRESENTATION_DIR].map((d) =>
		path.resolve(process.cwd(), d),
	);

	let filesToCheck: string[] = [];

	if (args.length > 0) {
		filesToCheck = args
			.map((f) => path.resolve(process.cwd(), f))
			.filter((f) => {
				const isUnderTarget = targetDirs.some((dir) => f.startsWith(dir));
				const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(f);
				return isUnderTarget && isTestFile && fs.existsSync(f);
			});
	}

	if (filesToCheck.length === 0) {
		filesToCheck = targetDirs.flatMap((dir) => globTestFiles(dir));
	}

	if (filesToCheck.length === 0) {
		console.log("未检测到需要检查的表现层测试文件。");
		process.exit(0);
	}

	let totalErrors = 0;

	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		const relativePath = path.relative(process.cwd(), file);
		const siblingIndex = path.join(path.dirname(file), "index.tsx");
		const siblingUsesUseDI =
			fs.existsSync(siblingIndex) &&
			fs.readFileSync(siblingIndex, "utf8").includes("useDI");
		const violations = checkCode(code, file, { siblingUsesUseDI });
		for (const loc of violations) {
			totalErrors++;
			console.error(
				`❌ 错误: ${relativePath}:${loc.line}:${loc.column} - ${loc.message}`,
			);
		}
	}

	if (totalErrors > 0) {
		console.error(
			`\n🛑 校验未通过：发现了 ${totalErrors} 处测试 DI 注入违规。请遵循「hook 单测参数注入 / 页面测试最小容器」规范。`,
		);
		process.exit(1);
	} else {
		console.log("✨ 表现层测试 DI 注入规范校验通过。");
		process.exit(0);
	}
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-presentation-test-di.ts") ||
		process.argv[1].endsWith("check-presentation-test-di.js"))
) {
	main();
}