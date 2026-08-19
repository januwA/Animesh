import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface HookErrorLocation {
	line: number;
	column: number;
	severity: "error";
	message: string;
}

/** 导出 hook 返回对象成员数上限（对齐 max-hook-return-surface 社区默认） */
const MAX_RETURN_SURFACE = 20;
/** deps 接口属性数上限，允许组合根聚合但限制过度耦合 */
const MAX_DEPS_MEMBERS = 8;
/** params 参数对象成员数上限 */
const MAX_PARAMS_MEMBERS = 5;
/** hook 内 useEffect 调用次数上限 */
const MAX_EFFECTS = 3;
/** hook 内 useQuery + useMutation 调用次数上限 */
const MAX_DATA_CALLS = 5;

const PRESENTATION_DIR = "src/presentation";
const HOOK_NAME_RE = /^use[A-Z]/;

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

function traverse(
	node: any,
	visit: (node: any, parent: any, grandparent: any) => void,
	parent: any = null,
	grandparent: any = null,
) {
	if (!node || typeof node !== "object") return;
	visit(node, parent, grandparent);
	for (const key in node) {
		if (Object.hasOwn(node, key)) {
			const child = node[key];
			if (Array.isArray(child)) {
				for (const item of child) traverse(item, visit, node, parent);
			} else if (child && typeof child === "object") {
				traverse(child, visit, node, parent);
			}
		}
	}
}

function unwrapExpression(node: any): any {
	let cur = node;
	while (
		cur &&
		typeof cur === "object" &&
		(cur.type === "TSAsExpression" ||
			cur.type === "TSSatisfiesExpression" ||
			cur.type === "TSNonNullExpression" ||
			cur.type === "ParenthesizedExpression")
	) {
		cur = cur.expression;
	}
	return cur;
}

function getTypeMembers(node: any): any[] | null {
	if (node?.type === "TSInterfaceDeclaration") {
		return node.body?.body ?? [];
	}
	if (
		node?.type === "TSTypeAliasDeclaration" &&
		node.typeAnnotation?.type === "TSTypeLiteral"
	) {
		return node.typeAnnotation.body ?? [];
	}
	return null;
}

/**
 * 检查表现层导出的 use* hook 是否过大或耦合过重：
 * - 返回对象成员数（含一层嵌套字面量）不超过 20
 * - deps 接口属性数不超过 8、params 接口属性数不超过 5
 * - useEffect 不超过 3 次、useQuery/useMutation 总数不超过 5
 */
export function checkCode(code: string, filepath: string): HookErrorLocation[] {
	const parseResult = parseTs(code, filepath);
	const errors: HookErrorLocation[] = [];

	// 收集候选 hook 函数（名称以 use 开头）及其导出名
	const hookFunctions = new Map<any, string>();
	const exportedNames = new Set<string>();

	traverse(parseResult.program, (node, parent, grandparent) => {
		if (node?.type === "FunctionDeclaration") {
			const name = node.id?.name;
			if (name && HOOK_NAME_RE.test(name)) {
				hookFunctions.set(node, name);
				if (parent?.type === "ExportNamedDeclaration") {
					exportedNames.add(name);
				}
			}
		}
		if (node?.type === "VariableDeclarator") {
			const name = node.id?.name;
			const init = node.init;
			if (
				name &&
				HOOK_NAME_RE.test(name) &&
				init &&
				(init.type === "ArrowFunctionExpression" ||
					init.type === "FunctionExpression")
			) {
				hookFunctions.set(init, name);
				if (
					parent?.type === "VariableDeclaration" &&
					grandparent?.type === "ExportNamedDeclaration"
				) {
					exportedNames.add(name);
				}
			}
		}
		if (node?.type === "ExportNamedDeclaration" && node.specifiers) {
			for (const spec of node.specifiers) {
				const local = spec.local?.name;
				if (local && HOOK_NAME_RE.test(local)) {
					exportedNames.add(local);
				}
			}
		}
	});

	function checkObjectSurface(
		hook: string,
		object: any,
		depth: number,
		label: string,
	): void {
		const count = object.properties.length;
		if (count > MAX_RETURN_SURFACE) {
			const loc = offsetToLoc(code, object.start);
			errors.push({
				...loc,
				severity: "error",
				message: `hook "${hook}" 的${label}返回对象暴露了 ${count} 个成员（上限 ${MAX_RETURN_SURFACE}），存在 god-controller 风险，请拆分为聚焦 hook 或返回内聚的子对象。`,
			});
		}
		if (depth >= 2) return;
		for (const prop of object.properties) {
			if (prop?.type !== "Property") continue;
			const value = unwrapExpression(prop.value);
			if (value?.type === "ObjectExpression") {
				const key =
					prop.key?.name ??
					(prop.key?.type === "Literal" ? String(prop.key.value) : "");
				checkObjectSurface(hook, value, depth + 1, `"${key}" 嵌套`);
			}
		}
	}

	function countHookCalls(fn: any): { effects: number; dataCalls: number } {
		let effects = 0;
		let dataCalls = 0;
		traverse(fn, (node) => {
			if (node?.type !== "CallExpression") return;
			const callee = node.callee;
			if (callee?.type !== "Identifier") return;
			if (callee.name === "useEffect") effects++;
			if (callee.name === "useQuery" || callee.name === "useMutation") {
				dataCalls++;
			}
		});
		return { effects, dataCalls };
	}

	function checkReturnSurface(fn: any, name: string): void {
		const body = fn.body;
		let returns: any[] = [];
		if (body?.type === "BlockStatement") {
			for (const stmt of body.body) {
				if (stmt?.type === "ReturnStatement" && stmt.argument) {
					returns.push(stmt.argument);
				}
			}
		} else {
			const implicit = unwrapExpression(body);
			if (implicit?.type === "ObjectExpression") {
				returns.push(implicit);
			}
		}
		for (const arg of returns) {
			const value = unwrapExpression(arg);
			if (value?.type === "ObjectExpression") {
				checkObjectSurface(name, value, 1, "");
			}
		}
	}

	for (const [fn, name] of hookFunctions) {
		if (!exportedNames.has(name)) continue;

		checkReturnSurface(fn, name);

		const { effects, dataCalls } = countHookCalls(fn);
		if (effects > MAX_EFFECTS) {
			const loc = offsetToLoc(code, fn.start);
			errors.push({
				...loc,
				severity: "error",
				message: `hook "${name}" 包含 ${effects} 次 useEffect（上限 ${MAX_EFFECTS}），副作用过多，请拆分职责或抽取子 hook。`,
			});
		}
		if (dataCalls > MAX_DATA_CALLS) {
			const loc = offsetToLoc(code, fn.start);
			errors.push({
				...loc,
				severity: "error",
				message: `hook "${name}" 包含 ${dataCalls} 次 useQuery/useMutation（上限 ${MAX_DATA_CALLS}），数据获取过多，请拆分为聚焦 hook。`,
			});
		}
	}

	// 检查 deps / params 接口耦合
	traverse(parseResult.program, (node) => {
		const name = node?.id?.name;
		if (!name) return;
		const members = getTypeMembers(node);
		if (!members) return;

		if (name.endsWith("Deps") && members.length > MAX_DEPS_MEMBERS) {
			const loc = offsetToLoc(code, node.start);
			errors.push({
				...loc,
				severity: "error",
				message: `deps 接口 "${name}" 包含 ${members.length} 个依赖（上限 ${MAX_DEPS_MEMBERS}），耦合过高，请拆分到聚焦 hook。`,
			});
		}
		if (name.endsWith("Params") && members.length > MAX_PARAMS_MEMBERS) {
			const loc = offsetToLoc(code, node.start);
			errors.push({
				...loc,
				severity: "error",
				message: `params 接口 "${name}" 包含 ${members.length} 个参数（上限 ${MAX_PARAMS_MEMBERS}），参数过多，请拆分为聚焦 hook。`,
			});
		}
	});

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
	}

	if (filesToCheck.length === 0) {
		filesToCheck = targetDirs.flatMap((dir) => globFiles(dir));
	}

	if (filesToCheck.length === 0) {
		console.log("未检测到需要检查的表现层文件。");
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
			`\n🛑 校验未通过：发现了 ${totalErrors} 处 hook 过大/耦合过重问题。请拆分为聚焦 hook 或返回内聚的子对象。`,
		);
		process.exit(1);
	} else {
		console.log("✨ 表现层 hook 大小与耦合规范校验通过。");
		process.exit(0);
	}
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-presentation-hooks.ts") ||
		process.argv[1].endsWith("check-presentation-hooks.js"))
) {
	main();
}