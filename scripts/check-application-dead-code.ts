import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface ApplicationClassError {
	name: string;
	filepath: string;
	line: number;
	column: number;
	severity: "error";
	message: string;
}

export interface ApplicationClassInfo {
	name: string;
	filepath: string;
	line: number;
	column: number;
}

const DI_CONTEXT_FILE = "src/di/DIContext.tsx";
const APPLICATION_DIR = "src/application";

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

export function parseApplicationClasses(
	code: string,
	filepath: string,
): ApplicationClassInfo[] {
	const parseResult = parseTs(code, filepath);
	const classes: ApplicationClassInfo[] = [];

	traverse(parseResult.program, (node) => {
		if (node.type !== "ClassDeclaration" || node.id?.type !== "Identifier") {
			return;
		}
		const loc = offsetToLoc(code, node.start);
		classes.push({ ...loc, name: node.id.name, filepath });
	});

	return classes;
}

export function collectInstantiatedClasses(
	code: string,
	filepath: string,
): Set<string> {
	const parseResult = parseTs(code, filepath);
	const instantiated = new Set<string>();

	traverse(parseResult.program, (node) => {
		if (
			node.type === "NewExpression" &&
			node.callee?.type === "Identifier"
		) {
			instantiated.add(node.callee.name);
		}
	});

	return instantiated;
}

export function checkDeadCode(
	classes: ApplicationClassInfo[],
	instantiated: Set<string>,
): ApplicationClassError[] {
	const errors: ApplicationClassError[] = [];
	for (const cls of classes) {
		if (!instantiated.has(cls.name)) {
			errors.push({
				...cls,
				severity: "error",
				message: `应用层类 "${cls.name}" 未在 DI 容器（${DI_CONTEXT_FILE}）中实例化，属于死代码。请将其接入 DI 装配或移除。`,
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

	const contextPath = path.resolve(process.cwd(), DI_CONTEXT_FILE);
	if (!fs.existsSync(contextPath)) {
		console.error(`❌ 未找到 DI 容器文件 ${DI_CONTEXT_FILE}。`);
		process.exit(1);
	}

	const contextCode = fs.readFileSync(contextPath, "utf8");
	const instantiated = collectInstantiatedClasses(contextCode, contextPath);

	const targetDirs = [APPLICATION_DIR].map((d) =>
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
	} else {
		filesToCheck = targetDirs.flatMap((dir) => globFiles(dir));
	}

	const classes: ApplicationClassInfo[] = [];
	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		classes.push(...parseApplicationClasses(code, file));
	}

	const errors = checkDeadCode(classes, instantiated);

	if (errors.length === 0) {
		console.log(
			`✨ 应用层死代码校验通过：${classes.length} 个类均已接入 DI 容器实例化。`,
		);
		process.exit(0);
	}

	const seen = new Map<string, ApplicationClassError>();
	for (const err of errors) {
		seen.set(err.name, err);
	}

	console.error(
		`❌ 应用层死代码校验未通过：${seen.size} 个类未接入 DI 容器。\n`,
	);
	console.error(
		`【未实例化死代码（${seen.size} 个）】\n  以下类未在 ${DI_CONTEXT_FILE} 中被 new 实例化。\n`,
	);
	for (const err of seen.values()) {
		const relativePath = path.relative(process.cwd(), err.filepath);
		console.error(`  - ${relativePath}:${err.line}:${err.column}  "${err.name}"`);
	}
	console.error("");
	console.error(`🛑 请将上述类接入 DI 装配（createDefaultDIContainer），或确认后移除。`);
	process.exit(1);
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-application-dead-code.ts") ||
		process.argv[1].endsWith("check-application-dead-code.js"))
) {
	main();
}
