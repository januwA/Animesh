import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

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

export function checkDeadCode(
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
			.filter((f) => {
				const isUnderTarget = f.startsWith(targetDir);
				const isSourceFile = /\.(js|jsx|ts|tsx)$/.test(f);
				const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(f);
				return isUnderTarget && isSourceFile && !isTestFile && fs.existsSync(f);
			});
		if (filesToCheck.length === 0) {
			filesToCheck = globFiles(targetDir);
		}
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

	const errors = checkDeadCode(classes, referencedByFile);

	if (errors.length === 0) {
		console.log(
			`✨ 基础设施死代码校验通过：${classes.length} 个导出类均被生产代码引用。`,
		);
		process.exit(0);
	}

	console.error(`❌ 基础设施死代码校验未通过：共 ${errors.length} 个类。\n`);
	console.error(`【未引用死代码（${errors.length} 个）】`);
	console.error(
		"  以下基础设施类未被 src/infrastructure 之外的生产代码引用，疑似重构后遗留。\n",
	);
	for (const err of errors) {
		const relativePath = path.relative(process.cwd(), err.filepath);
		console.error(`  - ${relativePath}:${err.line}:${err.column}  "${err.name}"`);
	}
	console.error(
		"\n🛑 请将上述类接入 DI 装配（repositories.ts / repositories.web.ts / DIContext.tsx），或确认后移除。",
	);
	process.exit(1);
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-infrastructure-dead-code.ts") ||
		process.argv[1].endsWith("check-infrastructure-dead-code.js"))
) {
	main();
}
