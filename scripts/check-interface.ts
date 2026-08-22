import fs from "node:fs";
import path from "node:path";
import {
	isSourceFile,
	keyName,
	offsetToLoc,
	parseCliArgs,
	parseTs,
	traverse,
	globFiles,
	type Violation,
} from "./check-utils";

const DOMAIN_DIR = "src/domain";
const APPLICATION_DIR = "src/application";
const INFRASTRUCTURE_DIR = "src/infrastructure";

/** ---------- 规则 1：接口/类不得包含可选方法 ---------- */

export function checkInterfaceMethods(code: string, filepath: string): Violation[] {
	const parseResult = parseTs(code, filepath);
	const errors: Violation[] = [];

	function isFunctionType(typeNode: any): boolean {
		if (!typeNode) return false;
		if (typeNode.type === "TSFunctionType") return true;
		if (typeNode.type === "TSUnionType" && Array.isArray(typeNode.types)) {
			return typeNode.types.some((t: any) => isFunctionType(t));
		}
		return false;
	}

	function report(node: any, methodName: string): void {
		const loc = offsetToLoc(code, node.start);
		errors.push({
			...loc,
			severity: "error",
			message: `接口设计中不能出现可为空的方法 ${methodName}。`,
		});
	}

	traverse(parseResult.program, (node) => {
		if (node.type === "TSMethodSignature") {
			if (node.optional) {
				report(node, node.key?.name || "anonymous");
			}
		}

		if (
			node.type === "MethodDefinition" ||
			node.type === "TSAbstractMethodDefinition"
		) {
			if (node.optional) {
				report(node, node.key?.name || "anonymous");
			}
		}

		if (node.type === "TSPropertySignature") {
			if (node.optional) {
				const innerType = node.typeAnnotation?.typeAnnotation;
				if (isFunctionType(innerType)) {
					report(node, node.key?.name || "anonymous");
				}
			}
		}

		if (
			node.type === "PropertyDefinition" ||
			node.type === "TSAbstractPropertyDefinition"
		) {
			if (node.optional) {
				const innerType = node.typeAnnotation?.typeAnnotation;
				const isFuncVal =
					node.value &&
					(node.value.type === "ArrowFunctionExpression" ||
						node.value.type === "FunctionExpression");
				if (isFunctionType(innerType) || isFuncVal) {
					report(node, node.key?.name || "anonymous");
				}
			}
		}
	});

	return errors;
}

/** ---------- 规则 2：基础设施实现类必须与接口契约一致 ---------- */

export interface InterfaceMethodError {
	className: string;
	interfaceName: string;
	methodName: string;
	filepath: string;
	line: number;
	column: number;
	severity: "error";
	message: string;
}

export interface ImplementationMethodInfo {
	name: string;
	line: number;
	column: number;
}

export interface ImplementationClassInfo {
	className: string;
	interfaces: string[];
	methods: ImplementationMethodInfo[];
}

export interface FileSystem {
	exists(absolutePath: string): boolean;
	readFile(absolutePath: string): string | null;
}

const MAX_RESOLVE_DEPTH = 8;

function isFunctionTypeAnnotation(ann: any): boolean {
	if (!ann) return false;
	if (ann.type === "TSFunctionType") return true;
	if (ann.type === "TSParenthesizedType") {
		return isFunctionTypeAnnotation(ann.typeAnnotation);
	}
	if (ann.type === "TSUnionType") {
		return (ann.types ?? []).some((t: any) => isFunctionTypeAnnotation(t));
	}
	return false;
}

export function parseInterfaceMethods(
	code: string,
	targetName: string,
): { methodNames: Set<string>; extendsNames: string[] } | null {
	const parseResult = parseTs(code, "interface.ts");
	let found: { methodNames: Set<string>; extendsNames: string[] } | null = null;

	traverse(parseResult.program, (node) => {
		if (found) return;
		if (node.type === "TSInterfaceDeclaration" && node.id?.name === targetName) {
			const methodNames = new Set<string>();
			for (const member of node.body?.body ?? []) {
				const name = keyName(member.key);
				if (!name) continue;
				if (member.type === "TSMethodSignature") {
					methodNames.add(name);
				} else if (member.type === "TSPropertySignature") {
					if (isFunctionTypeAnnotation(member.typeAnnotation?.typeAnnotation)) {
						methodNames.add(name);
					}
				}
			}
			const extendsNames = (node.extends ?? [])
				.map((h: any) => h.expression)
				.filter((e: any) => e?.type === "Identifier")
				.map((e: any) => e.name);
			found = { methodNames, extendsNames };
			return;
		}
		if (
			node.type === "TSTypeAliasDeclaration" &&
			node.id?.name === targetName &&
			node.typeAnnotation?.type === "TSTypeLiteral"
		) {
			const methodNames = new Set<string>();
			for (const member of node.typeAnnotation.members ?? []) {
				const name = keyName(member.key);
				if (!name) continue;
				if (member.type === "TSMethodSignature") {
					methodNames.add(name);
				} else if (member.type === "TSPropertySignature") {
					if (isFunctionTypeAnnotation(member.typeAnnotation?.typeAnnotation)) {
						methodNames.add(name);
					}
				}
			}
			found = { methodNames, extendsNames: [] };
		}
	});

	return found;
}

export function resolveBindingTarget(
	code: string,
	filepath: string,
	localName: string,
): { source: string; exportedName: string } | null {
	const parseResult = parseTs(code, filepath);
	let result: { source: string; exportedName: string } | null = null;

	traverse(parseResult.program, (node) => {
		if (result || node.type !== "ImportDeclaration") return;
		if (node.source?.type !== "Literal" || typeof node.source.value !== "string") {
			return;
		}
		for (const spec of node.specifiers ?? []) {
			if (spec.type !== "ImportSpecifier") continue;
			if (spec.local?.name !== localName) continue;
			result = {
				source: node.source.value,
				exportedName: spec.imported?.name ?? spec.local.name,
			};
			return;
		}
	});

	return result;
}

export function resolveModulePath(
	fromFile: string,
	specifier: string,
	exists: (p: string) => boolean,
): string | null {
	const base = specifier.startsWith("@/")
		? path.resolve(process.cwd(), "src", specifier.slice(2))
		: path.resolve(path.dirname(fromFile), specifier);

	const candidates = [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		`${base}.js`,
		`${base}.jsx`,
		path.join(base, "index.ts"),
		path.join(base, "index.tsx"),
		path.join(base, "index.js"),
		path.join(base, "index.jsx"),
	];

	return candidates.find((candidate) => exists(candidate)) ?? null;
}

export function resolveInterfaceMethodSet(
	fileContent: string,
	filepath: string,
	targetName: string,
	fs: FileSystem,
	depth = 0,
): Set<string> | null {
	if (depth > MAX_RESOLVE_DEPTH) return null;

	const declared = parseInterfaceMethods(fileContent, targetName);
	if (declared) {
		const merged = new Set(declared.methodNames);
		for (const extName of declared.extendsNames) {
			const sub = resolveInterfaceMethodSet(
				fileContent,
				filepath,
				extName,
				fs,
				depth + 1,
			);
			if (sub) {
				for (const method of sub) merged.add(method);
			}
		}
		return merged;
	}

	const binding = resolveBindingTarget(fileContent, filepath, targetName);
	if (!binding) return null;
	const targetPath = resolveModulePath(filepath, binding.source, (p) =>
		fs.exists(p),
	);
	if (!targetPath) return null;
	const content = fs.readFile(targetPath);
	if (content == null) return null;
	return resolveInterfaceMethodSet(
		content,
		targetPath,
		binding.exportedName,
		fs,
		depth + 1,
	);
}

export function parseImplementationClassPublicMethods(
	code: string,
	filepath: string,
): ImplementationClassInfo[] {
	const parseResult = parseTs(code, filepath);
	const classes: ImplementationClassInfo[] = [];

	traverse(parseResult.program, (node) => {
		if (node.type !== "ClassDeclaration" || node.id?.type !== "Identifier") {
			return;
		}
		const interfaces = (node.implements ?? [])
			.map((imp: any) => imp.expression)
			.filter((e: any) => e?.type === "Identifier")
			.map((e: any) => e.name);
		if (interfaces.length === 0) return;

		const methods: ImplementationMethodInfo[] = [];
		const seen = new Set<string>();
		for (const element of node.body?.body ?? []) {
			let isMethodLike = false;
			if (element.type === "MethodDefinition") {
				isMethodLike =
					element.kind !== "constructor" &&
					element.static === false &&
					element.accessibility !== "private" &&
					element.accessibility !== "protected";
			} else if (element.type === "PropertyDefinition") {
				isMethodLike =
					element.static === false &&
					element.accessibility !== "private" &&
					element.accessibility !== "protected" &&
					(element.value?.type === "ArrowFunctionExpression" ||
						element.value?.type === "FunctionExpression");
			}
			if (!isMethodLike) continue;

			const name = keyName(element.key);
			if (!name || seen.has(name)) continue;
			seen.add(name);
			const loc = offsetToLoc(code, element.start);
			methods.push({ name, ...loc });
		}

		classes.push({ className: node.id.name, interfaces, methods });
	});

	return classes;
}

export function checkInterfaceConformance(
	implCode: string,
	filepath: string,
	fs: FileSystem,
): InterfaceMethodError[] {
	const classes = parseImplementationClassPublicMethods(implCode, filepath);
	const errors: InterfaceMethodError[] = [];

	for (const cls of classes) {
		for (const interfaceName of cls.interfaces) {
			const methodSet = resolveInterfaceMethodSet(
				implCode,
				filepath,
				interfaceName,
				fs,
			);
			if (!methodSet) continue;

			for (const method of cls.methods) {
				if (methodSet.has(method.name)) continue;
				errors.push({
					className: cls.className,
					interfaceName,
					methodName: method.name,
					filepath,
					line: method.line,
					column: method.column,
					severity: "error",
					message: `public 方法 "${method.name}" 未在接口 "${interfaceName}" 中声明，疑似接口删除后遗留的死代码。若确属有意扩展，请将其纳入接口契约或移除。`,
				});
			}
		}
	}

	return errors;
}

/** ---------- 合并 CLI ---------- */

interface MethodError extends Violation {
	filepath: string;
}

function runMethodsCheck(args: string[]): MethodError[] {
	const targetDirs = [DOMAIN_DIR, INFRASTRUCTURE_DIR, APPLICATION_DIR].map((d) =>
		path.resolve(process.cwd(), d),
	);

	let filesToCheck: string[] = [];
	if (args.length > 0) {
		filesToCheck = args
			.map((f) => path.resolve(process.cwd(), f))
			.filter(
				(f) =>
					targetDirs.some((dir) => f.startsWith(dir)) &&
					isSourceFile(f) &&
					fs.existsSync(f),
			);
	} else {
		filesToCheck = targetDirs.flatMap((dir) => globFiles(dir));
	}

	const errors: MethodError[] = [];
	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		const violations = checkInterfaceMethods(code, file);
		for (const v of violations) {
			errors.push({ ...v, filepath: file });
		}
	}
	return errors;
}

function runConformanceCheck(args: string[]): InterfaceMethodError[] {
	const targetDir = path.resolve(process.cwd(), INFRASTRUCTURE_DIR);
	if (!fs.existsSync(targetDir)) {
		console.error(`❌ 未找到基础设施目录 ${INFRASTRUCTURE_DIR}。`);
		process.exit(1);
	}

	let filesToCheck: string[] = [];
	if (args.length > 0) {
		filesToCheck = args
			.map((f) => path.resolve(process.cwd(), f))
			.filter(
				(f) => f.startsWith(targetDir) && isSourceFile(f) && fs.existsSync(f),
			);
	} else {
		filesToCheck = globFiles(targetDir);
	}

	const realFs: FileSystem = {
		exists: (p) => fs.existsSync(p),
		readFile: (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null),
	};

	const errors: InterfaceMethodError[] = [];
	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		errors.push(...checkInterfaceConformance(code, file, realFs));
	}
	return errors;
}

function main() {
	const args = parseCliArgs();
	const methodErrors = runMethodsCheck(args);
	const conformanceErrors = runConformanceCheck(args);

	const totalErrors = methodErrors.length + conformanceErrors.length;
	if (totalErrors === 0) {
		process.exit(0);
	}

	if (methodErrors.length > 0) {
		console.error(
			`❌ 接口方法设计校验未通过：发现 ${methodErrors.length} 处违规（包含可为空/可选的方法设计）。请重构为非可选的方法设计。\n`,
		);
		for (const err of methodErrors) {
			const relativePath = path.relative(process.cwd(), err.filepath);
			console.error(
				`  - ${relativePath}:${err.line}:${err.column} - ${err.message}`,
			);
		}
		console.error("");
	}

	if (conformanceErrors.length > 0) {
		console.error(`❌ 接口实现契约校验未通过：共 ${conformanceErrors.length} 处违规。\n`);
		console.error(`【接口契约违规（${conformanceErrors.length} 处）】`);
		console.error(
			"  以下类的 public 方法未在对应的 implements 接口中声明，疑似接口方法删除后遗留的死代码。\n",
		);
		for (const err of conformanceErrors) {
			const relativePath = path.relative(process.cwd(), err.filepath);
			console.error(
				`  - ${relativePath}:${err.line}:${err.column}  类 "${err.className}" 的 public 方法 "${err.methodName}" 未在接口 "${err.interfaceName}" 中声明`,
			);
		}
		console.error("\n🛑 请将这些方法纳入接口契约，或确认其已无使用后移除。");
	}

	process.exit(1);
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-interface.ts") ||
		process.argv[1].endsWith("check-interface.js"))
) {
	main();
}