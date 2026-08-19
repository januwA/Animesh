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

/** ---------- 应用层死代码 ---------- */

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

/** ---------- 基础设施死代码 ---------- */

export interface InfrastructureClassError {
	name: string;
	filepath: string;
	line: number;
	column: number;
	severity: "error";
	message: string;
}

export interface InfrastructureClassInfo {
	name: string;
	filepath: string;
	line: number;
	column: number;
}

const INFRASTRUCTURE_DIR = "src/infrastructure";
const SOURCE_DIR = "src";

export function parseInfrastructureClasses(
	code: string,
	filepath: string,
): InfrastructureClassInfo[] {
	const parseResult = parseTs(code, filepath);
	const classes: InfrastructureClassInfo[] = [];

	traverse(parseResult.program, (node) => {
		let declaration: any = null;
		if (node.type === "ExportNamedDeclaration") {
			declaration = node.declaration;
		} else if (node.type === "ExportDefaultDeclaration") {
			declaration = node.declaration;
		}
		if (declaration?.type !== "ClassDeclaration") return;
		if (declaration.id?.type !== "Identifier") return;

		const loc = offsetToLoc(code, declaration.start);
		classes.push({ ...loc, name: declaration.id.name, filepath });
	});

	return classes;
}

function collectReferences(node: any, refs: Set<string>) {
	if (!node || typeof node !== "object") return;
	if (node.type === "Identifier") {
		refs.add(node.name);
		return;
	}
	if (node.type === "MemberExpression") {
		collectReferences(node.object, refs);
		if (node.computed) collectReferences(node.property, refs);
		return;
	}
	if (node.type === "Property" || node.type === "ObjectProperty") {
		if (node.computed) collectReferences(node.key, refs);
		collectReferences(node.value, refs);
		return;
	}
	if (
		node.type === "PropertyDefinition" ||
		node.type === "MethodDefinition" ||
		node.type === "TSPropertySignature" ||
		node.type === "TSMethodSignature" ||
		node.type === "TSIndexSignature"
	) {
		if (node.computed) collectReferences(node.key, refs);
		collectReferences(node.typeAnnotation, refs);
		collectReferences(node.parameters, refs);
		collectReferences(node.returnType, refs);
		collectReferences(node.value, refs);
		return;
	}
	for (const key in node) {
		if (!Object.hasOwn(node, key)) continue;
		const child = node[key];
		if (Array.isArray(child)) {
			for (const item of child) collectReferences(item, refs);
		} else {
			collectReferences(child, refs);
		}
	}
}

export function collectReferencedIdentifiers(
	code: string,
	filepath: string,
): Set<string> {
	const parseResult = parseTs(code, filepath);
	const refs = new Set<string>();
	collectReferences(parseResult.program, refs);
	return refs;
}

export function checkInfrastructureDeadCode(
	classes: InfrastructureClassInfo[],
	referencedByFile: Map<string, Set<string>>,
): InfrastructureClassError[] {
	const errors: InfrastructureClassError[] = [];
	for (const cls of classes) {
		const isReferenced = [...referencedByFile.entries()].some(
			([file, names]) =>
				path.resolve(file) !== path.resolve(cls.filepath) &&
				names.has(cls.name),
		);
		if (isReferenced) continue;
		errors.push({
			...cls,
			severity: "error",
			message: `基础设施类 "${cls.name}" 未在 src/infrastructure 之外被任何生产代码引用（未接入 DI 装配），属于死代码。请将其接入 DI（repositories.ts / repositories.web.ts / DIContext.tsx）或移除。`,
		});
	}
	return errors;
}

/** ---------- 合并 CLI ---------- */

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

function runInfrastructureCheck(args: string[]): InfrastructureClassError[] {
	const targetDir = path.resolve(process.cwd(), INFRASTRUCTURE_DIR);
	const sourceDir = path.resolve(process.cwd(), SOURCE_DIR);
	if (!fs.existsSync(targetDir)) {
		console.error(`❌ 未找到基础设施目录 ${INFRASTRUCTURE_DIR}。`);
		process.exit(1);
	}

	let filesToCheck: string[] = [];
	if (args.length > 0) {
		filesToCheck = args
			.map((f) => path.resolve(process.cwd(), f))
			.filter((f) => f.startsWith(targetDir) && isSourceFile(f) && fs.existsSync(f));
	} else {
		filesToCheck = globFiles(targetDir);
	}

	const classes: InfrastructureClassInfo[] = [];
	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		classes.push(...parseInfrastructureClasses(code, file));
	}

	const referenceFiles = globFiles(sourceDir);
	const referencedByFile = new Map<string, Set<string>>();
	for (const file of referenceFiles) {
		const code = fs.readFileSync(file, "utf8");
		referencedByFile.set(file, collectReferencedIdentifiers(code, file));
	}

	return checkInfrastructureDeadCode(classes, referencedByFile);
}

function main() {
	const args = parseCliArgs();
	const appErrors = runApplicationCheck(args);
	const infraErrors = runInfrastructureCheck(args);

	if (appErrors.length === 0 && infraErrors.length === 0) {
		console.log("✨ 死代码校验通过：应用层与基础设施层均无死代码。");
		process.exit(0);
	}

	if (appErrors.length > 0) {
		const seen = new Map<string, ApplicationClassError>();
		for (const err of appErrors) seen.set(err.name, err);
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
	}

	if (infraErrors.length > 0) {
		console.error(`❌ 基础设施死代码校验未通过：共 ${infraErrors.length} 个类。\n`);
		console.error(`【未引用死代码（${infraErrors.length} 个）】`);
		console.error(
			"  以下基础设施类未被 src/infrastructure 之外的生产代码引用，疑似重构后遗留。\n",
		);
		for (const err of infraErrors) {
			const relativePath = path.relative(process.cwd(), err.filepath);
			console.error(
				`  - ${relativePath}:${err.line}:${err.column}  "${err.name}"`,
			);
		}
		console.error(
			"\n🛑 请将上述类接入 DI 装配（repositories.ts / repositories.web.ts / DIContext.tsx），或确认后移除。",
		);
	}

	process.exit(1);
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-dead-code.ts") ||
		process.argv[1].endsWith("check-dead-code.js"))
) {
	main();
}