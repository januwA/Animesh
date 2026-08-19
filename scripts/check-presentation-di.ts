import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface DiErrorLocation {
	line: number;
	column: number;
	severity: "error";
	message: string;
}

const PRESENTATION_DIR = "src/presentation";
const PAGES_DIR = "src/presentation/pages";
const CONTEXT_DIR = "src/presentation/context";
const ROUTES_FILE = "src/presentation/routes.tsx";

function toPosix(filepath: string): string {
	return path.resolve(filepath).replace(/\\/g, "/");
}

/**
 * 判断文件是否为组合根（允许调用 useDI()）：
 * - 页面入口（pages/**\/index.tsx）或单文件页面（pages/*.tsx）
 * - 上下文 Provider（context/**）
 * - 应用外壳路由（routes.tsx）
 */
export function isCompositionRoot(filepath: string): boolean {
	const normalized = toPosix(filepath);
	const cwd = process.cwd().replace(/\\/g, "/");
	const pagesDir = `${cwd}/${PAGES_DIR}`;
	const contextDir = `${cwd}/${CONTEXT_DIR}`;
	const routesFile = `${cwd}/${ROUTES_FILE}`;

	if (normalized === routesFile) return true;
	if (normalized.startsWith(`${contextDir}/`)) return true;
	if (normalized.startsWith(`${pagesDir}/`)) {
		const dir = path.posix.dirname(normalized);
		const basename = path.posix.basename(normalized);
		if (basename === "index.tsx") return true;
		if (dir === pagesDir) return true;
	}
	return false;
}

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

export function resolveUseDILocalName(program: any): string | null {
	let localName: string | null = null;
	traverse(program, (node) => {
		if (node.type !== "ImportDeclaration") return;
		const source = node.source;
		if (source?.type !== "Literal" || typeof source.value !== "string") return;
		if (!source.value.endsWith("di/DIContext")) return;
		for (const spec of node.specifiers ?? []) {
			if (
				spec.type === "ImportSpecifier" &&
				spec.imported?.type === "Identifier" &&
				spec.imported.name === "useDI"
			) {
				localName = spec.local?.name ?? "useDI";
			}
		}
	});
	return localName;
}

/**
 * 检查 useDI 使用规范：
 * - 仅组合根文件允许调用 useDI()；
 * - 组合根内 useDI() 必须显式解构（const { a, b } = useDI()），
 *   禁止 const di = useDI() 别名或 useXxxPage(useDI()) 直接传参。
 */
export function checkCode(code: string, filepath: string): DiErrorLocation[] {
	const parseResult = parseTs(code, filepath);
	const program = parseResult.program;
	const useDILocal = resolveUseDILocalName(program);
	if (!useDILocal) return [];

	const isRoot = isCompositionRoot(filepath);
	const errors: DiErrorLocation[] = [];

	const useDIcalls: { offset: number }[] = [];
	const destructuredInits = new Set<number>();

	traverse(program, (node) => {
		if (
			node.type === "CallExpression" &&
			node.callee?.type === "Identifier" &&
			node.callee.name === useDILocal
		) {
			useDIcalls.push({ offset: node.start });
		}
		if (
			node.type === "VariableDeclarator" &&
			node.id?.type === "ObjectPattern" &&
			node.init?.type === "CallExpression" &&
			node.init.callee?.type === "Identifier" &&
			node.init.callee.name === useDILocal
		) {
			destructuredInits.add(node.init.start);
		}
	});

	for (const call of useDIcalls) {
		if (!isRoot) {
			const loc = offsetToLoc(code, call.offset);
			errors.push({
				...loc,
				severity: "error",
				message: `表现层文件调用了 useDI()，但 useDI() 只允许出现在组合根（页面入口 pages/**/index.tsx、单文件页面 pages/*.tsx、上下文 Provider、routes.tsx）。Hook 依赖应通过参数注入，组件依赖应通过 props 注入。`,
			});
			continue;
		}
		if (!destructuredInits.has(call.offset)) {
			const loc = offsetToLoc(code, call.offset);
			errors.push({
				...loc,
				severity: "error",
				message: `useDI() 必须显式解构使用（const { xxxUseCase } = useDI()）。禁止 const di = useDI() 别名或 useXxxPage(useDI()) 直接传参，否则 check:di 无法识别 key 是否被使用。`,
			});
		}
	}

	return errors;
}

function globFiles(dir: string): string[] {
	const results: string[] = [];
	if (!fs.existsSync(dir)) return results;
	const list = fs.readdirSync(dir);
	for (const file of list) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat && stat.isDirectory()) {
			results.push(...globFiles(filePath));
		} else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
			// 排除测试文件
			if (!/\.(test|spec)\.[jt]sx?$/.test(file)) {
				results.push(filePath);
			}
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
				const isSourceFile = /\.(js|jsx|ts|tsx)$/.test(f);
				const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(f);
				return isUnderTarget && isSourceFile && !isTestFile && fs.existsSync(f);
			});
	}

	if (filesToCheck.length === 0) {
		filesToCheck = targetDirs.flatMap((dir) => globFiles(dir));
	}

	if (filesToCheck.length === 0) {
		console.log("未检测到需要检查的表现层文件。");
		process.exit(0);
	}

	let totalErrors = 0;

	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		const relativePath = path.relative(process.cwd(), file);
		const violations = checkCode(code, file);
		for (const loc of violations) {
			totalErrors++;
			console.error(
				`❌ 错误: ${relativePath}:${loc.line}:${loc.column} - ${loc.message}`,
			);
		}
	}

	if (totalErrors > 0) {
		console.error(
			`\n🛑 校验未通过：发现了 ${totalErrors} 处 useDI() 使用违规。请将依赖通过参数/props 注入，仅组合根显式解构 useDI()。`,
		);
		process.exit(1);
	} else {
		console.log("✨ 表现层 useDI() 使用规范校验通过。");
		process.exit(0);
	}
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-presentation-di.ts") ||
		process.argv[1].endsWith("check-presentation-di.js"))
) {
	main();
}