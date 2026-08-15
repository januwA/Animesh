import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

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

const INFRASTRUCTURE_DIR = "src/infrastructure";
const MAX_RESOLVE_DEPTH = 8;

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

function keyName(key: any): string | null {
	if (key?.type === "Identifier") return key.name;
	if (key?.type === "Literal" && typeof key.value === "string") return key.value;
	return null;
}

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

	const realFs: FileSystem = {
		exists: (p) => fs.existsSync(p),
		readFile: (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null),
	};

	const errors: InterfaceMethodError[] = [];
	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		errors.push(...checkInterfaceConformance(code, file, realFs));
	}

	if (errors.length === 0) {
		console.log(
			`✨ 接口实现契约校验通过：${filesToCheck.length} 个文件的所有 public 方法均与接口声明匹配。`,
		);
		process.exit(0);
	}

	console.error(`❌ 接口实现契约校验未通过：共 ${errors.length} 处违规。\n`);
	console.error(`【接口契约违规（${errors.length} 处）】`);
	console.error(
		"  以下类的 public 方法未在对应的 implements 接口中声明，疑似接口方法删除后遗留的死代码。\n",
	);
	for (const err of errors) {
		const relativePath = path.relative(process.cwd(), err.filepath);
		console.error(
			`  - ${relativePath}:${err.line}:${err.column}  类 "${err.className}" 的 public 方法 "${err.methodName}" 未在接口 "${err.interfaceName}" 中声明`,
		);
	}
	console.error(
		"\n🛑 请将这些方法纳入接口契约，或确认其已无使用后移除。",
	);
	process.exit(1);
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-interface-conformance.ts") ||
		process.argv[1].endsWith("check-interface-conformance.js"))
) {
	main();
}
