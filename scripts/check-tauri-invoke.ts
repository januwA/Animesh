import fs from "node:fs";
import path from "node:path";
import {
	globFiles,
	isSourceFile,
	offsetToLoc,
	parseCliArgs,
	parseTs,
	traverse,
	type Violation,
} from "./check-utils";

const INFRA_DIR = "src/infrastructure";
const COMMANDS_FILE = "src/generated/tauri-commands.ts";

/** 解析 tauri-commands.ts，提取 commands 对象中所有 key 与 snake_case 值 */
function parseCommandRegistry(): Map<string, string> {
	const filePath = path.resolve(process.cwd(), COMMANDS_FILE);
	const code = fs.readFileSync(filePath, "utf8");
	const parseResult = parseTs(code, COMMANDS_FILE);
	const commands = new Map<string, string>();

	traverse(parseResult.program, (node) => {
		if (
			node.type === "VariableDeclarator" &&
			node.id?.type === "Identifier" &&
			node.id.name === "commands" &&
			(node.init?.type === "ObjectExpression" ||
				(node.init?.type === "TSAsExpression" &&
					node.init.expression?.type === "ObjectExpression"))
		) {
			const objectExpr =
				node.init.type === "TSAsExpression"
					? node.init.expression
					: node.init;
			for (const prop of objectExpr.properties ?? []) {
				if (prop.type !== "Property") continue;
				const key =
					prop.key?.type === "Identifier"
						? prop.key.name
						: prop.key?.type === "Literal" && typeof prop.key.value === "string"
							? prop.key.value
							: null;
				const value =
					prop.value?.type === "Literal" && typeof prop.value.value === "string"
						? prop.value.value
						: null;
				if (key && value) {
					commands.set(key, value);
				}
			}
		}
	});

	return commands;
}

/** 规则 1：invoke 魔法字符串检测 */
export function checkInvokeMagicString(
	code: string,
	filepath: string,
): Violation[] {
	const parseResult = parseTs(code, filepath);
	const errors: Violation[] = [];

	traverse(parseResult.program, (node) => {
		if (node.type !== "CallExpression") return;
		if (node.callee?.type !== "Identifier" || node.callee.name !== "invoke")
			return;
		if (!node.arguments || node.arguments.length === 0) return;

		const firstArg = node.arguments[0];
		if (
			firstArg.type === "StringLiteral" ||
			(firstArg.type === "Literal" && typeof firstArg.value === "string")
		) {
			const loc = offsetToLoc(code, firstArg.start);
			errors.push({
				...loc,
				severity: "error",
				message: `invoke 使用了魔法字符串 "${firstArg.value}"，应使用 commands.${firstArg.value}`,
			});
		}
	});

	return errors;
}

/** 规则 2：死命令检测 — 检查 commands 的 key 是否在给定文件内容中被引用 */
export function checkDeadCommands(
	commands: Map<string, string>,
	fileContents: Map<string, string>,
): Violation[] {
	const usedKeys = new Set<string>();

	for (const [, code] of fileContents) {
		for (const [cmdName] of commands) {
			if (usedKeys.has(cmdName)) continue;
			if (code.includes(cmdName)) {
				usedKeys.add(cmdName);
			}
		}
	}

	const errors: Violation[] = [];
	for (const [cmdName] of commands) {
		if (!usedKeys.has(cmdName)) {
			errors.push({
				line: 1,
				column: 1,
				severity: "error",
				message: `死命令：${cmdName} 未被引用，建议后端删除`,
			});
		}
	}

	return errors;
}

/** 读取 src/infrastructure 下所有源文件内容 */
function readInfraFileContents(): Map<string, string> {
	const infraDir = path.resolve(process.cwd(), INFRA_DIR);
	const files = globFiles(infraDir, { includeTests: true });
	const contents = new Map<string, string>();
	for (const file of files) {
		contents.set(file, fs.readFileSync(file, "utf8"));
	}
	return contents;
}

interface MagicStringFix {
	start: number;
	end: number;
	cmdName: string;
}

/** 收集文件中所有魔法字符串的位置和命令名 */
function collectMagicStrings(
	code: string,
	filepath: string,
): MagicStringFix[] {
	const parseResult = parseTs(code, filepath);
	const fixes: MagicStringFix[] = [];

	traverse(parseResult.program, (node) => {
		if (node.type !== "CallExpression") return;
		if (node.callee?.type !== "Identifier" || node.callee.name !== "invoke")
			return;
		if (!node.arguments || node.arguments.length === 0) return;

		const firstArg = node.arguments[0];
		if (
			(firstArg.type === "StringLiteral" ||
				(firstArg.type === "Literal" && typeof firstArg.value === "string")) &&
			typeof firstArg.value === "string"
		) {
			fixes.push({
				start: firstArg.start,
				end: firstArg.end,
				cmdName: firstArg.value,
			});
		}
	});

	return fixes;
}

/** 检查文件是否已导入 commands */
function hasCommandsImport(code: string, filepath: string): boolean {
	const parseResult = parseTs(code, filepath);
	let found = false;
	traverse(parseResult.program, (node) => {
		if (node.type !== "ImportDeclaration") return;
		const source = node.source;
		if (source?.type !== "Literal" || typeof source.value !== "string") return;
		if (!source.value.includes("tauri-commands")) return;
		for (const spec of node.specifiers ?? []) {
			if (
				spec.type === "ImportSpecifier" &&
				spec.imported?.type === "Identifier" &&
				spec.imported.name === "commands"
			) {
				found = true;
			}
		}
	});
	return found;
}

/** 自动修复魔法字符串：替换字符串字面量为 commands.xxx，并补 import */
function fixMagicStrings(
	code: string,
	filepath: string,
): { code: string; count: number } {
	const fixes = collectMagicStrings(code, filepath);
	if (fixes.length === 0) return { code, count: 0 };

	let result = code;
	for (const f of fixes.reverse()) {
		result =
			result.slice(0, f.start) + `commands.${f.cmdName}` + result.slice(f.end);
	}

	if (!hasCommandsImport(result, filepath)) {
		const importLine = `import { commands } from "@/generated/tauri-commands";\n`;
		const importParseResult = parseTs(result, filepath);
		let lastImportEnd = 0;
		traverse(importParseResult.program, (node) => {
			if (node.type === "ImportDeclaration" && node.end > lastImportEnd) {
				lastImportEnd = node.end;
			}
		});
		if (lastImportEnd > 0) {
			result =
				result.slice(0, lastImportEnd) +
				"\n" +
				importLine +
				result.slice(lastImportEnd).replace(/^\n/, "");
		} else {
			result = importLine + result;
		}
	}

	return { code: result, count: fixes.length };
}

const isFix = process.argv.includes("--fix");

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-tauri-invoke.ts") ||
		process.argv[1].endsWith("check-tauri-invoke.js"))
) {
	const infraDir = path.resolve(process.cwd(), INFRA_DIR);
	const infraFiles = globFiles(infraDir, { includeTests: true }).filter(
		(f) => isSourceFile(f),
	);

	if (isFix) {
		const fileArgs = parseCliArgs().filter((a) => !a.startsWith("--"));
		const targetFiles =
			fileArgs.length > 0
				? 			fileArgs
						.map((f) => path.resolve(process.cwd(), f))
						.filter(
							(f) =>
								f.startsWith(infraDir) &&
								isSourceFile(f) &&
								fs.existsSync(f),
						)
				: infraFiles;
		if (targetFiles.length === 0) {
			process.exit(0);
		}

		let fixedCount = 0;
		for (const file of targetFiles) {
			const code = fs.readFileSync(file, "utf8");
			const result = fixMagicStrings(code, file);
			if (result.count > 0) {
				fs.writeFileSync(file, result.code, "utf8");
				console.log(
					`✅ ${path.relative(process.cwd(), file)} - 修复 ${result.count} 处`,
				);
				fixedCount += result.count;
			}
		}
		if (fixedCount > 0) {
			console.log(`\n🔧 共修复 ${fixedCount} 处魔法字符串。`);
		}
		process.exit(0);
	}

	// 规则 1: invoke 魔法字符串检测
	const magicStringErrors: { file: string; violations: Violation[] }[] = [];
	for (const file of infraFiles) {
		const code = fs.readFileSync(file, "utf8");
		const violations = checkInvokeMagicString(code, file);
		if (violations.length > 0) {
			magicStringErrors.push({
				file: path.relative(process.cwd(), file),
				violations,
			});
		}
	}

	// 规则 2: 死命令检测
	const commands = parseCommandRegistry();
	const fileContents = readInfraFileContents();
	const deadCommandErrors = checkDeadCommands(commands, fileContents);

	// 统一输出
	let totalErrors = 0;

	if (magicStringErrors.length > 0) {
		for (const { file, violations } of magicStringErrors) {
			for (const v of violations) {
				totalErrors++;
				console.error(
					`❌ ${file}:${v.line}:${v.column} - ${v.message}`,
				);
			}
		}
	}

	if (deadCommandErrors.length > 0) {
		for (const v of deadCommandErrors) {
			totalErrors++;
			console.error(
				`❌ ${COMMANDS_FILE}:${v.line}:${v.column} - ${v.message}`,
			);
		}
	}

	if (totalErrors > 0) {
		console.error(`\n🛑 ${totalErrors} 个错误。`);
		process.exit(1);
	}

}
