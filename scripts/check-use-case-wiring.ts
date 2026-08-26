import fs from "node:fs";
import path from "node:path";
import {
	isSourceFile,
	offsetToLoc,
	parseCliArgs,
	parseTs,
	globFiles,
	traverse,
} from "./check-utils";

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

export function checkApplicationDeadCode(
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

function runApplicationCheck(args: string[]): ApplicationClassError[] {
	const contextPath = path.resolve(process.cwd(), DI_CONTEXT_FILE);
	if (!fs.existsSync(contextPath)) {
		console.error(`❌ 未找到 DI 容器文件 ${DI_CONTEXT_FILE}。`);
		process.exit(1);
	}

	const contextCode = fs.readFileSync(contextPath, "utf8");
	const instantiated = collectInstantiatedClasses(contextCode, contextPath);

	const targetDir = path.resolve(process.cwd(), APPLICATION_DIR);

	let filesToCheck: string[] = [];
	if (args.length > 0) {
		filesToCheck = args
			.map((f) => path.resolve(process.cwd(), f))
			.filter((f) => f.startsWith(targetDir) && isSourceFile(f) && fs.existsSync(f));
	} else {
		filesToCheck = globFiles(targetDir);
	}

	const classes: ApplicationClassInfo[] = [];
	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		classes.push(...parseApplicationClasses(code, file));
	}

	return checkApplicationDeadCode(classes, instantiated);
}

function main() {
	const args = parseCliArgs();
	const errors = runApplicationCheck(args);

	if (errors.length === 0) {
		process.exit(0);
	}

	const seen = new Map<string, ApplicationClassError>();
	for (const err of errors) seen.set(err.name, err);
	console.error(
		`❌ 应用层接入校验未通过：${seen.size} 个类未接入 DI 容器。\n`,
	);
	console.error(
		`【未实例化死代码（${seen.size} 个）】\n  以下类未在 ${DI_CONTEXT_FILE} 中被 new 实例化。\n`,
	);
	for (const err of seen.values()) {
		const relativePath = path.relative(process.cwd(), err.filepath);
		console.error(`  - ${relativePath}:${err.line}:${err.column}  "${err.name}"`);
	}
	console.error(
		"\n🛑 请将上述类接入 DI 装配（DIContext.tsx），或确认后移除。",
	);

	process.exit(1);
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-use-case-wiring.ts") ||
		process.argv[1].endsWith("check-use-case-wiring.js"))
) {
	main();
}