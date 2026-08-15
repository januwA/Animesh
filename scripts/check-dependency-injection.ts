import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface DependencyErrorLocation {
	line: number;
	column: number;
	severity: "error";
	message: string;
}

const TARGET_DIRS = ["src/application", "src/infrastructure"];

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

function isInternalModuleSpecifier(specifier: string): boolean {
	return (
		specifier.startsWith("./") ||
		specifier.startsWith("../") ||
		specifier.startsWith("@/")
	);
}

/**
 * 检查文件内是否存在直接实例化项目内部依赖的违规。
 *
 * 规则：src/application 与 src/infrastructure 层不得直接 new 项目内部类，
 * 依赖必须通过构造函数注入（由 DI 容器装配）。以下情况豁免：
 * - 内建类型、平台 API 与第三方库类（基础设施作为适配层可自由实例化）；
 * - 类实例化自身（如 Builder/Clone 风格的 withCategory 返回 new 自身）。
 */
export function checkCode(
	code: string,
	filepath: string,
): DependencyErrorLocation[] {
	const parseResult = parseTs(code, filepath);

	const internalNames = new Set<string>();
	traverse(parseResult.program, (node) => {
		if (node.type === "ClassDeclaration" && node.id?.type === "Identifier") {
			internalNames.add(node.id.name);
			return;
		}
		if (node.type !== "ImportDeclaration") return;
		const source = node.source;
		if (source?.type !== "Literal" || typeof source.value !== "string") return;
		if (!isInternalModuleSpecifier(source.value)) return;
		for (const spec of node.specifiers ?? []) {
			if (spec?.local?.type === "Identifier") {
				internalNames.add(spec.local.name);
			}
		}
	});

	const classes: { name: string; start: number; end: number }[] = [];
	const newExpressions: { callee: string; offset: number }[] = [];

	traverse(parseResult.program, (node) => {
		if (node.type === "ClassDeclaration" && node.id?.type === "Identifier") {
			classes.push({ name: node.id.name, start: node.start, end: node.end });
			return;
		}
		if (
			node.type === "NewExpression" &&
			node.callee?.type === "Identifier" &&
			internalNames.has(node.callee.name)
		) {
			newExpressions.push({ callee: node.callee.name, offset: node.start });
		}
	});

	const errors: DependencyErrorLocation[] = [];

	for (const expr of newExpressions) {
		let enclosing: { name: string } | null = null;
		let innermostStart = -1;
		for (const cls of classes) {
			if (
				cls.start <= expr.offset &&
				expr.offset <= cls.end &&
				cls.start > innermostStart
			) {
				enclosing = cls;
				innermostStart = cls.start;
			}
		}

		if (enclosing && enclosing.name === expr.callee) continue;

		const loc = offsetToLoc(code, expr.offset);
		errors.push({
			...loc,
			severity: "error",
			message: `直接实例化了项目内部依赖 "${expr.callee}"，违反依赖注入原则：项目内部依赖必须通过构造函数注入（由 DI 容器装配）。仅第三方库与平台类可在基础设施适配层直接实例化。`,
		});
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

	const targetDirs = TARGET_DIRS.map((d) => path.resolve(process.cwd(), d));

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
		console.log("未检测到需要检查的源码文件。");
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
			`\n🛑 校验未通过：发现了 ${totalErrors} 处直接实例化项目内部依赖的违规。请将这些依赖改为构造函数注入，并在 DI 容器（repositories.ts / repositories.web.ts / DIContext.tsx）中装配。`,
		);
		process.exit(1);
	} else {
		console.log(
			"✨ 依赖注入规范校验通过：应用层与基础设施层未直接实例化项目内部依赖。",
		);
		process.exit(0);
	}
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-dependency-injection.ts") ||
		process.argv[1].endsWith("check-dependency-injection.js"))
) {
	main();
}
