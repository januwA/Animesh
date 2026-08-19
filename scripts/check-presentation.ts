import fs from "node:fs";
import path from "node:path";
import {
	isSourceFile,
	isTestFile,
	keyName,
	offsetToLoc,
	parseTs,
	runChecks,
	traverse,
	type CheckRule,
	type Violation,
} from "./check-utils";

const PRESENTATION_DIR = "src/presentation";

/** ---------- 规则 1：表现层禁止导入 Tauri 依赖 ---------- */

export function checkTauriImports(code: string, filepath: string): Violation[] {
	const parseResult = parseTs(code, filepath);
	const errors: Violation[] = [];

	const isTauriImport = (sourceNode: any) => {
		if (
			sourceNode &&
			(sourceNode.type === "StringLiteral" || sourceNode.type === "Literal")
		) {
			const val = sourceNode.value;
			return (
				typeof val === "string" &&
				(val === "@tauri-apps" || val.startsWith("@tauri-apps/"))
			);
		}
		return false;
	};

	traverse(parseResult.program, (node) => {
		if (
			node.type === "ImportDeclaration" ||
			node.type === "ImportExpression" ||
			node.type === "ExportNamedDeclaration" ||
			node.type === "ExportAllDeclaration"
		) {
			if (isTauriImport(node.source)) {
				const loc = offsetToLoc(code, node.start);
				errors.push({
					...loc,
					severity: "error",
					message: `表现层代码禁止导入 Tauri 相关的依赖包 "${node.source.value}"，请通过 DI 容器与 UseCase 进行解耦。`,
				});
			}
		}
	});

	return errors;
}

/** ---------- 规则 2：表现层禁用硬编码样式类 ---------- */

const FORBIDDEN_STYLE_REGEX =
	/\b(?:bg|border|outline|ring|divide)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|border|outline|ring|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\/\d+/g;

const IGNORED_DIRS = ["src/presentation/components/ui"];

function isIgnoredFile(filepath: string): boolean {
	const normalized = path.resolve(filepath).replace(/\\/g, "/");
	return IGNORED_DIRS.some((dir) =>
		normalized.startsWith(
			path.resolve(process.cwd(), dir).replace(/\\/g, "/"),
		),
	);
}

export function checkStyles(code: string, filepath: string): Violation[] {
	const parseResult = parseTs(code, filepath);
	const errors: Violation[] = [];
	const lines = code.split("\n");

	traverse(parseResult.program, (node) => {
		let value = "";
		let startOffset = 0;

		if (node.type === "StringLiteral" || node.type === "Literal") {
			value = node.value;
			startOffset = node.start;
		} else if (node.type === "TemplateElement") {
			value = node.value.raw;
			startOffset = node.start;
		}

		if (value && typeof value === "string") {
			const matches = value.match(FORBIDDEN_STYLE_REGEX);
			if (matches && matches.length > 0) {
				const loc = offsetToLoc(code, startOffset);
				const lineIndex = loc.line - 1;
				const linesToCheck = lines.slice(
					Math.max(0, lineIndex - 3),
					lineIndex + 4,
				);
				if (!linesToCheck.some((l) => l.includes("style-ignore"))) {
					errors.push({
						...loc,
						severity: "error",
						message: `表现层代码检测到非法的硬编码样式类 "${matches.join(", ")}"，应使用 border-border, bg-secondary, bg-muted 等自适应语义类进行替换。若有特殊原因，请在当前行添加 "// style-ignore" 绕过。`,
					});
				}
			}
		}
	});

	return errors;
}

/** ---------- 规则 3：useDI() 仅组合根显式解构 ---------- */

const PAGES_DIR = "src/presentation/pages";
const CONTEXT_DIR = "src/presentation/context";
const ROUTES_FILE = "src/presentation/routes.tsx";

function toPosix(filepath: string): string {
	return path.resolve(filepath).replace(/\\/g, "/");
}

export function isCompositionRoot(filepath: string): boolean {
	const normalized = toPosix(filepath);
	const cwd = process.cwd().replace(/\\/g, "/");
	const pagesDir = `${cwd}/${PAGES_DIR}`;
	const contextDir = `${cwd}/${CONTEXT_DIR}`;
	const routesFile = `${cwd}/${ROUTES_FILE}`;

	if (normalized === routesFile) return true;
	if (normalized.startsWith(`${contextDir}/`)) return true;
	if (normalized.startsWith(`${pagesDir}/`)) {
		const dir = path.posix.dirname(normalized);
		const basename = path.posix.basename(normalized);
		if (basename === "index.tsx") return true;
		if (dir === pagesDir) return true;
	}
	return false;
}

export function resolveUseDILocalName(program: any): string | null {
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

export function checkUseDI(code: string, filepath: string): Violation[] {
	const parseResult = parseTs(code, filepath);
	const program = parseResult.program;
	const useDILocal = resolveUseDILocalName(program);
	if (!useDILocal) return [];

	const isRoot = isCompositionRoot(filepath);
	const errors: Violation[] = [];

	const useDIcalls: { offset: number }[] = [];
	const destructuredInits = new Set<number>();

	traverse(program, (node) => {
		if (
			node.type === "CallExpression" &&
			node.callee?.type === "Identifier" &&
			node.callee.name === useDILocal
		) {
			useDIcalls.push({ offset: node.start });
		}
		if (
			node.type === "VariableDeclarator" &&
			node.id?.type === "ObjectPattern" &&
			node.init?.type === "CallExpression" &&
			node.init.callee?.type === "Identifier" &&
			node.init.callee.name === useDILocal
		) {
			destructuredInits.add(node.init.start);
		}
	});

	for (const call of useDIcalls) {
		if (!isRoot) {
			const loc = offsetToLoc(code, call.offset);
			errors.push({
				...loc,
				severity: "error",
				message: `表现层文件调用了 useDI()，但 useDI() 只允许出现在组合根（页面入口 pages/**/index.tsx、单文件页面 pages/*.tsx、上下文 Provider、routes.tsx）。Hook 依赖应通过参数注入，组件依赖应通过 props 注入。`,
			});
			continue;
		}
		if (!destructuredInits.has(call.offset)) {
			const loc = offsetToLoc(code, call.offset);
			errors.push({
				...loc,
				severity: "error",
				message: `useDI() 必须显式解构使用（const { xxxUseCase } = useDI()）。禁止 const di = useDI() 别名或 useXxxPage(useDI()) 直接传参，否则 check:di 无法识别 key 是否被使用。`,
			});
		}
	}

	return errors;
}

/** ---------- 规则 4：deps 接口属性必须 Pick<UseCase, "execute"> ---------- */

export function isPickExecuteType(typeNode: any): boolean {
	if (typeNode?.type !== "TSTypeReference") return false;
	if (typeNode.typeName?.type !== "Identifier") return false;
	if (typeNode.typeName.name !== "Pick") return false;
	const args =
		typeNode.typeArguments?.params ??
		typeNode.typeArguments?.typeParameters?.params ??
		[];
	if (args.length !== 2) return false;
	if (args[0]?.type !== "TSTypeReference") return false;
	const second = args[1];
	if (second?.type !== "TSLiteralType") return false;
	if (second.literal?.type !== "Literal") return false;
	return second.literal.value === "execute";
}

export function checkDeps(code: string, filepath: string): Violation[] {
	const parseResult = parseTs(code, filepath);
	const errors: Violation[] = [];

	traverse(parseResult.program, (node) => {
		let name: string | null = null;
		let body: any = null;
		let start = 0;

		if (node.type === "TSInterfaceDeclaration") {
			name = node.id?.type === "Identifier" ? node.id.name : null;
			body = node.body;
			start = node.start;
		} else if (
			node.type === "TSTypeAliasDeclaration" &&
			node.typeAnnotation?.type === "TSTypeLiteral"
		) {
			name = node.id?.type === "Identifier" ? node.id.name : null;
			body = node.typeAnnotation;
			start = node.start;
		}

		if (!name || !name.endsWith("Deps") || !body) return;

		const members = body.body ?? body.members ?? [];
		for (const member of members) {
			if (member.type !== "TSPropertySignature") continue;
			const propName = keyName(member.key);
			const typeNode = member.typeAnnotation?.typeAnnotation;
			if (isPickExecuteType(typeNode)) continue;

			const loc = offsetToLoc(code, start);
			errors.push({
				...loc,
				severity: "error",
				message: `deps 接口 "${name}" 的属性 "${propName ?? "(匿名)"}" 必须使用 Pick<XxxUseCase, "execute"> 声明，使测试可直接传 { execute: vi.fn() } 而无需 cast。`,
			});
		}
	});

	return errors;
}

/** ---------- 规则 5：hook 大小与耦合 ---------- */

const MAX_RETURN_SURFACE = 20;
const MAX_DEPS_MEMBERS = 8;
const MAX_PARAMS_MEMBERS = 5;
const MAX_EFFECTS = 3;
const MAX_DATA_CALLS = 5;

const HOOK_NAME_RE = /^use[A-Z]/;

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

export function checkHooks(code: string, filepath: string): Violation[] {
	const parseResult = parseTs(code, filepath);
	const errors: Violation[] = [];

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

/** ---------- 规则 6：测试 DI 注入规范 ---------- */

const CREATE_CONTAINER_IMPORT = "createDIContainerForTest";
const DIPROVIDER_IMPORT = "DIProvider";

export function isHookTestFile(filepath: string): boolean {
	const basename = path.posix.basename(filepath.replace(/\\/g, "/"));
	return /^use.+\.test\.[jt]sx?$/.test(basename);
}

export function isPageTestFile(filepath: string): boolean {
	const normalized = filepath.replace(/\\/g, "/");
	const basename = path.posix.basename(normalized);
	if (!/^index\.test\.[jt]sx?$/.test(basename)) return false;
	return normalized.includes(`/src/presentation/pages/`);
}

export function collectImportNames(program: any): Set<string> {
	const names = new Set<string>();
	traverse(program, (node) => {
		if (node.type !== "ImportDeclaration") return;
		for (const spec of node.specifiers ?? []) {
			if (
				spec.type === "ImportSpecifier" &&
				spec.imported?.type === "Identifier"
			) {
				names.add(spec.imported.name);
			}
		}
	});
	return names;
}

export function hasDIContainerCast(program: any): boolean {
	let found = false;
	traverse(program, (node) => {
		if (found) return;
		if (node.type !== "TSAsExpression") return;
		const ann = node.typeAnnotation;
		if (
			ann?.type === "TSTypeReference" &&
			ann.typeName?.type === "Identifier" &&
			ann.typeName.name === "DIContainer"
		) {
			found = true;
		}
	});
	return found;
}

export interface TestDiCheckOptions {
	siblingUsesUseDI: boolean;
}

function detectSiblingContext(filepath: string): TestDiCheckOptions {
	const siblingIndex = path.join(path.dirname(filepath), "index.tsx");
	const siblingUsesUseDI =
		fs.existsSync(siblingIndex) &&
		fs.readFileSync(siblingIndex, "utf8").includes("useDI");
	return { siblingUsesUseDI };
}

export function checkTestDi(
	code: string,
	filepath: string,
	options: TestDiCheckOptions = detectSiblingContext(filepath),
): Violation[] {
	const parseResult = parseTs(code, filepath);
	const program = parseResult.program;
	const imports = collectImportNames(program);
	const errors: Violation[] = [];

	const report = (offset: number, message: string) => {
		const loc = offsetToLoc(code, offset);
		errors.push({ ...loc, severity: "error", message });
	};

	if (isHookTestFile(filepath)) {
		const importOffset = code.indexOf(CREATE_CONTAINER_IMPORT);
		if (imports.has(CREATE_CONTAINER_IMPORT)) {
			report(
				importOffset >= 0 ? importOffset : 0,
				`hook 级单测不得使用 createDIContainerForTest，hook 的 use case 依赖应通过参数直接注入 mock（{ execute: vi.fn() }），断言上移到 use case 的 execute 层。`,
			);
		}
	}

	if (isPageTestFile(filepath) && options.siblingUsesUseDI) {
		if (!imports.has(DIPROVIDER_IMPORT)) {
			report(
				0,
				`页面级集成测试必须渲染组合根，并使用 <DIProvider value={mock as unknown as DIContainer}> 注入最小 mock 容器（需 import DIProvider）。`,
			);
		}
		if (!hasDIContainerCast(program)) {
			report(
				0,
				`页面级集成测试的 mock 容器必须通过 as unknown as DIContainer 断言构造，禁止依赖 createDIContainerForTest。`,
			);
		}
		if (imports.has(CREATE_CONTAINER_IMPORT)) {
			const importOffset = code.indexOf(CREATE_CONTAINER_IMPORT);
			report(
				importOffset >= 0 ? importOffset : 0,
				`页面级集成测试不得使用 createDIContainerForTest，应手写最小 mock 容器并显式列出组合根与所有子组件/Provider 消费的 key（如 TorrentStatusProvider 需要 subscribeTorrentsUseCase）。`,
			);
		}
	}

	return errors;
}

/** ---------- 合并 CLI ---------- */

const rules: CheckRule[] = [
	{
		name: "Tauri导入",
		targetDirs: [PRESENTATION_DIR],
		check: checkTauriImports,
	},
	{
		name: "样式",
		targetDirs: [PRESENTATION_DIR],
		includeFile: (f) => isSourceFile(f) && !isIgnoredFile(f),
		check: checkStyles,
	},
	{
		name: "useDI使用",
		targetDirs: [PRESENTATION_DIR],
		check: checkUseDI,
	},
	{
		name: "deps接口",
		targetDirs: [PRESENTATION_DIR],
		check: checkDeps,
	},
	{
		name: "hook大小与耦合",
		targetDirs: [PRESENTATION_DIR],
		check: checkHooks,
	},
	{
		name: "测试DI注入",
		targetDirs: [PRESENTATION_DIR],
		includeFile: (f) => isTestFile(f),
		check: checkTestDi,
	},
];

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-presentation.ts") ||
		process.argv[1].endsWith("check-presentation.js"))
) {
	runChecks("表现层", rules);
}