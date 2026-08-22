import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

/** 校验违规定位信息 */
export interface Violation {
	line: number;
	column: number;
	severity: "error" | "warning";
	message: string;
}

/** 单个校验规则 */
export interface CheckRule {
	/** 规则名（错误输出前缀，便于定位问题归属） */
	name: string;
	/** 目标目录（相对仓库根，可多个） */
	targetDirs: string[];
	/** 文件过滤，默认仅源文件（排除测试文件） */
	includeFile?: (absoluteFile: string) => boolean;
	/** 校验实现 */
	check(code: string, filepath: string): Violation[];
}

const SOURCE_FILE_RE = /\.(js|jsx|ts|tsx)$/;
const SOURCE_LIKE_FILE_RE = /\.(js|jsx|ts|tsx|mjs|cjs)$/;
const TEST_FILE_RE = /\.(test|spec)\.[jt]sx?$/;

export function isTestFile(filepath: string): boolean {
	return TEST_FILE_RE.test(path.basename(filepath));
}

export function isSourceFile(filepath: string): boolean {
	return SOURCE_FILE_RE.test(path.basename(filepath)) && !isTestFile(filepath);
}

/** 宽松的源文件判定（包含 mjs/cjs，不排除测试文件） */
export function isSourceLikeFile(filepath: string): boolean {
	return SOURCE_LIKE_FILE_RE.test(path.basename(filepath));
}

export function offsetToLoc(
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

export function parseTs(
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

export function traverse(
	node: any,
	visit: (
		node: any,
		parent: any,
		grandparent: any,
		catchParam: string | null,
		parentKey: string | null,
		parentType: string | null,
	) => void,
	parent: any = null,
	grandparent: any = null,
	catchParam: string | null = null,
	parentKey: string | null = null,
	parentType: string | null = null,
) {
	if (!node || typeof node !== "object") return;
	visit(node, parent, grandparent, catchParam, parentKey, parentType);

	let nextCatchParam = catchParam;
	if (node.type === "CatchClause") {
		nextCatchParam = node.param?.name ?? null;
	}

	for (const key in node) {
		if (Object.hasOwn(node, key)) {
			const child = node[key];
			if (Array.isArray(child)) {
				for (const item of child) {
					traverse(item, visit, node, parent, nextCatchParam, key, node.type);
				}
			} else if (child && typeof child === "object") {
				traverse(child, visit, node, parent, nextCatchParam, key, node.type);
			}
		}
	}
}

export function keyName(key: any): string | null {
	if (key?.type === "Identifier") return key.name;
	if (key?.type === "Literal" && typeof key.value === "string") return key.value;
	return null;
}

/** 解析命令行传入的文件参数（兼容 lefthook 空格分隔的 push_files） */
export function parseCliArgs(): string[] {
	return process.argv
		.slice(2)
		.flatMap((f) => f.split(/\s+/))
		.filter(Boolean);
}

export interface GlobOptions {
	/** 是否包含测试文件，默认 false */
	includeTests?: boolean;
	/** 额外忽略规则（绝对路径） */
	ignore?: (absoluteFile: string) => boolean;
}

export function globFiles(dir: string, options: GlobOptions = {}): string[] {
	const results: string[] = [];
	if (!fs.existsSync(dir)) return results;
	const list = fs.readdirSync(dir);
	for (const file of list) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat && stat.isDirectory()) {
			results.push(...globFiles(filePath, options));
		} else if (SOURCE_LIKE_FILE_RE.test(file)) {
			if (!options.includeTests && isTestFile(file)) continue;
			if (options.ignore && options.ignore(filePath)) continue;
			results.push(filePath);
		}
	}
	return results;
}

export function resolveTargetDirs(dirs: string[]): string[] {
	return [...new Set(dirs)].map((d) => path.resolve(process.cwd(), d));
}

/**
 * 通用多规则 CLI runner：
 * - 传入文件参数时仅检查这些文件（不再全量回退，避免误扫）；没有参数时全量扫描。
 * - 逐规则过滤目标目录与文件类型，错误按规则名分区输出。
 * - 存在 error 级违规时退出码 1；仅 warning 时退出码 0。
 */
export function runChecks(scriptLabel: string, rules: CheckRule[]): void {
	const args = parseCliArgs();
	const unionTargetDirs = resolveTargetDirs(
		rules.flatMap((r) => r.targetDirs),
	);

	let candidates: string[] = [];
	if (args.length > 0) {
		candidates = args
			.map((f) => path.resolve(process.cwd(), f))
			.filter(
				(f) =>
					unionTargetDirs.some((dir) => f.startsWith(dir)) && fs.existsSync(f),
			);
		if (candidates.length === 0) {
			process.exit(0);
		}
	} else {
		candidates = unionTargetDirs.flatMap((dir) =>
			globFiles(dir, { includeTests: true }),
		);
	}

	if (candidates.length === 0) {
		process.exit(0);
	}

	let totalErrors = 0;
	let totalWarnings = 0;
	const ruleCounts = new Map<string, number>();

	for (const rule of rules) {
		const ruleDirs = resolveTargetDirs(rule.targetDirs);
		const files = candidates.filter((f) => {
			const underTarget = ruleDirs.some((dir) => f.startsWith(dir));
			if (!underTarget) return false;
			if (rule.includeFile) return rule.includeFile(f);
			return isSourceFile(f);
		});

		for (const file of files) {
			const code = fs.readFileSync(file, "utf8");
			const rel = path.relative(process.cwd(), file);
			let violations: Violation[];
			try {
				violations = rule.check(code, file);
			} catch (err) {
				violations = [
					{
						line: 1,
						column: 1,
						severity: "error",
						message: `解析失败: ${
							err instanceof Error ? err.message : String(err)
						}`,
					},
				];
			}
			for (const loc of violations) {
				ruleCounts.set(rule.name, (ruleCounts.get(rule.name) ?? 0) + 1);
				if (loc.severity === "error") {
					totalErrors++;
					console.error(
						`❌ [${rule.name}] ${rel}:${loc.line}:${loc.column} - ${loc.message}`,
					);
				} else {
					totalWarnings++;
					console.warn(
						`⚠️ [${rule.name}] ${rel}:${loc.line}:${loc.column} - ${loc.message}`,
					);
				}
			}
		}
	}

	if (totalErrors > 0) {
		console.error(
			`\n🛑 ${scriptLabel}校验未通过：发现 ${totalErrors} 处错误${
				totalWarnings > 0 ? `、${totalWarnings} 处警告` : ""
			}。`,
		);
		for (const [name, count] of ruleCounts) {
			console.error(`  - ${name}: ${count} 处`);
		}
		process.exit(1);
	}
	if (totalWarnings > 0) {
		console.warn(
			`\n⚠️ ${scriptLabel}校验通过，但有 ${totalWarnings} 处警告，请确认是否为合法的降级逻辑。`,
		);
		process.exit(0);
	}
	process.exit(0);
}