import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface DIErrorLocation {
	line: number;
	column: number;
	severity: "error";
	message: string;
}

export type DIKeyError = DIErrorLocation &
	Pick<DIContainerKeyInfo, "name" | "typeName">;

export interface DIContainerKeyInfo {
	name: string;
	typeName: string | null;
	line: number;
	column: number;
}

const DI_CONTEXT_FILE = "src/di/DIContext.tsx";
const PRESENTATION_DIR = "src/presentation";

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

function isCallTo(
	node: any,
	name: string,
): node is { type: "CallExpression" } {
	return (
		node?.type === "CallExpression" &&
		node.callee?.type === "Identifier" &&
		node.callee.name === name
	);
}

function objectPatternKeys(pattern: any): string[] {
	if (pattern?.type !== "ObjectPattern") return [];
	const keys: string[] = [];
	for (const prop of pattern.properties ?? []) {
		if (prop.type !== "Property" || prop.computed) continue;
		if (prop.key?.type === "Identifier") {
			keys.push(prop.key.name);
		} else if (prop.key?.type === "Literal" && typeof prop.key.value === "string") {
			keys.push(prop.key.value);
		}
	}
	return keys;
}

function resolveUseDILocalName(program: any): string | null {
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

export function parseDIContainer(
	code: string,
	filepath: string,
): DIContainerKeyInfo[] {
	const parseResult = parseTs(code, filepath);
	const keys: DIContainerKeyInfo[] = [];

	traverse(parseResult.program, (node) => {
		if (
			node.type !== "TSInterfaceDeclaration" ||
			node.id?.name !== "DIContainer"
		) {
			return;
		}
		for (const member of node.body?.body ?? []) {
			if (member.type !== "TSPropertySignature") continue;
			if (member.key?.type !== "Identifier") continue;

			let typeName: string | null = null;
			const typeNode = member.typeAnnotation?.typeAnnotation;
			if (typeNode?.type === "TSTypeReference") {
				typeName = typeNode.typeName?.name ?? null;
			}

			const loc = offsetToLoc(code, member.start);
			keys.push({ ...loc, name: member.key.name, typeName });
		}
	});

	return keys;
}

export function collectUsedDIKeys(
	code: string,
	filepath: string,
): Set<string> {
	const parseResult = parseTs(code, filepath);
	const program = parseResult.program;
	const useDILocal = resolveUseDILocalName(program);
	if (!useDILocal) return new Set();

	const aliases = new Set<string>();

	// 第一遍：收集 const di = useDI() 的别名
	traverse(program, (node) => {
		if (node.type !== "VariableDeclarator") return;
		if (node.id?.type === "Identifier" && isCallTo(node.init, useDILocal)) {
			aliases.add(node.id.name);
		}
	});

	const used = new Set<string>();

	// 第二遍：收集通过 useDI 解构 / 成员访问命中的 key
	traverse(program, (node) => {
		if (node.type === "VariableDeclarator") {
			if (node.id?.type !== "ObjectPattern") return;
			const init = node.init;
			const isDirectUseDI = isCallTo(init, useDILocal);
			const isAliasUse =
				init?.type === "Identifier" && aliases.has(init.name);
			if (isDirectUseDI || isAliasUse) {
				for (const key of objectPatternKeys(node.id)) used.add(key);
			}
		}

		if (node.type === "MemberExpression") {
			if (node.computed) return;
			if (node.property?.type !== "Identifier") return;
			const obj = node.object;
			const isDirectUseDI = isCallTo(obj, useDILocal);
			const isAliasUse = obj?.type === "Identifier" && aliases.has(obj.name);
			if (isDirectUseDI || isAliasUse) {
				used.add(node.property.name);
			}
		}
	});

	return used;
}

export function checkDIContainer(
	keys: DIContainerKeyInfo[],
): DIKeyError[] {
	const errors: DIKeyError[] = [];
	for (const key of keys) {
		if (key.typeName?.endsWith("Repository")) {
			errors.push({
				...key,
				severity: "error",
				message: `DIContainer 中不能包含 "${key.name}"（类型 ${key.typeName} 为 Repository）。Repository 应由应用层 UseCase 封装，避免表现层直接依赖基础设施导致架构分层不清晰。`,
			});
		}
	}
	return errors;
}

export function checkDeadCode(
	keys: DIContainerKeyInfo[],
	usedKeys: Set<string>,
): DIKeyError[] {
	const errors: DIKeyError[] = [];
	for (const key of keys) {
		if (!usedKeys.has(key.name)) {
			errors.push({
				...key,
				severity: "error",
				message: `DI 容器中的 "${key.name}" 未在表现层生产代码（src/presentation，不含测试）中使用，属于死代码。`,
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
	const containerKeys = parseDIContainer(contextCode, contextPath);

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
		if (filesToCheck.length === 0) {
			filesToCheck = targetDirs.flatMap((dir) => globFiles(dir));
		}
	} else {
		filesToCheck = targetDirs.flatMap((dir) => globFiles(dir));
	}

	if (containerKeys.length === 0) {
		console.error("❌ 未在 DIContainer 接口中解析到任何 key。");
		process.exit(1);
	}

	const usedKeys = new Set<string>();
	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		for (const key of collectUsedDIKeys(code, file)) {
			usedKeys.add(key);
		}
	}

	const deadErrors = checkDeadCode(containerKeys, usedKeys);
	const repoErrors = checkDIContainer(containerKeys);
	const totalErrors = deadErrors.length + repoErrors.length;

	if (totalErrors === 0) {
		process.exit(0);
	}

	const relativePath = path.relative(process.cwd(), contextPath);
	const fmtLocation = (e: DIErrorLocation) =>
		`${relativePath}:${e.line}:${e.column}`;

	const groups: { title: string; description: string; items: string[] }[] = [];

	if (repoErrors.length > 0) {
		groups.push({
			title: `Repository 违规（${repoErrors.length} 处）`,
			description:
				"DIContainer 不应暴露 Repository，应由应用层 UseCase 封装，避免表现层直接依赖基础设施。",
			items: repoErrors.map(
				(e) =>
					`- ${fmtLocation(e)}  "${e.name}"（类型 ${e.typeName}）`,
			),
		});
	}

	if (deadErrors.length > 0) {
		groups.push({
			title: `死代码（${deadErrors.length} 处）`,
			description:
				"以下 key 未在表现层生产代码（src/presentation，不含测试）中使用。",
			items: deadErrors.map((e) => `- ${fmtLocation(e)}  "${e.name}"`),
		});
	}

	console.error(`❌ DI 容器校验未通过：共 ${totalErrors} 处违规。\n`);
	for (const group of groups) {
		console.error(`【${group.title}】`);
		console.error(`  ${group.description}`);
		for (const item of group.items) {
			console.error(`  ${item}`);
		}
		console.error("");
	}
	console.error(`🛑 请修复后重新运行 pnpm check:di。`);
	process.exit(1);
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-di-container.ts") ||
		process.argv[1].endsWith("check-di-container.js"))
) {
	main();
}
