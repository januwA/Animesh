import {
	isSourceLikeFile,
	offsetToLoc,
	parseTs,
	runChecks,
	traverse,
	type CheckRule,
	type Violation,
} from "./check-utils";

const APPLICATION_DIR = "src/application";
const INFRASTRUCTURE_DIR = "src/infrastructure";

/** ---------- 规则 1：错误处理与 console 禁用 ---------- */

export function checkErrorHandling(code: string, filepath: string): Violation[] {
	const parseResult = parseTs(code, filepath);
	const errors: Violation[] = [];

	function isValidCauseOptions(arg: any, catchParam: string): boolean {
		if (!arg || arg.type !== "ObjectExpression") return false;
		const props = arg.properties || [];
		return props.some((prop: any) => {
			if (prop.type !== "ObjectProperty" && prop.type !== "Property") return false;
			const isCauseKey =
				(prop.key.type === "Identifier" && prop.key.name === "cause") ||
				(prop.key.type === "Literal" && prop.key.value === "cause");
			const isMatchingValue =
				prop.value.type === "Identifier" && prop.value.name === catchParam;
			return isCauseKey && isMatchingValue;
		});
	}

	function hasThrow(root: any): boolean {
		let found = false;
		function check(n: any) {
			if (found || !n || typeof n !== "object") return;
			if (n.type === "ThrowStatement") {
				found = true;
				return;
			}
			if (n.type === "CatchClause") {
				return;
			}
			for (const k in n) {
				if (Object.hasOwn(n, k)) {
					const val = n[k];
					if (Array.isArray(val)) {
						for (const item of val) check(item);
					} else if (val && typeof val === "object") {
						check(val);
					}
				}
			}
		}
		check(root.body);
		return found;
	}

	traverse(parseResult.program, (node, _parent, _grandparent, catchParam, parentKey, parentType) => {
		if (node.type === "Identifier" && node.name === "console") {
			const isMemberProperty =
				parentType === "MemberExpression" && parentKey === "property";
			const isObjectKey =
				(parentType === "Property" || parentType === "ObjectProperty") &&
				parentKey === "key";
			const isClassProperty =
				(parentType === "PropertyDefinition" ||
					parentType === "MethodDefinition") &&
				parentKey === "key";
			const isDeclaration =
				(parentType === "VariableDeclarator" && parentKey === "id") ||
				(parentType === "FunctionDeclaration" && parentKey === "id") ||
				(parentType === "ClassDeclaration" && parentKey === "id") ||
				parentType === "FormalParameter";

			if (
				!isMemberProperty &&
				!isObjectKey &&
				!isClassProperty &&
				!isDeclaration
			) {
				const loc = offsetToLoc(code, node.start);
				errors.push({
					...loc,
					severity: "error",
					message: "禁用了 console 对象的所有成员访问和调用。",
				});
			}
		}

		if (node.type === "ThrowStatement" && catchParam) {
			const arg = node.argument;
			if (arg) {
				const isThrowingParamDirectly =
					arg.type === "Identifier" && arg.name === catchParam;
				if (!isThrowingParamDirectly) {
					let hasValidCause = false;
					if (arg.type === "NewExpression") {
						const args = arg.arguments || [];
						hasValidCause =
							args.length >= 2 && isValidCauseOptions(args[1], catchParam);
					}
					if (!hasValidCause) {
						const loc = offsetToLoc(code, node.start);
						errors.push({
							...loc,
							severity: "error",
							message:
								"重新包装抛出新错误时，必须使用 { cause: err } 选项保留原始错误链。",
						});
					}
				}
			}
		}

		if (node.type === "CatchClause") {
			const hasRethrow = hasThrow(node);
			if (!hasRethrow) {
				const loc = offsetToLoc(code, node.start);
				errors.push({
					...loc,
					severity: "warning",
					message:
						"发现疑似吞掉错误的 catch 块（未向上抛出错误或重新包装抛出）。建议处理并继续向上抛出，以符合错误处理规范。",
				});
			}
		}
	});

	return errors;
}

/** ---------- 规则 2：应用层 execute 方法参数不超过 2 个 ---------- */

export function checkApplicationParams(
	code: string,
	filepath: string,
): Violation[] {
	const parseResult = parseTs(code, filepath);
	const errors: Violation[] = [];

	function checkParams(params: any[], start: number): void {
		if (params.length > 2) {
			const loc = offsetToLoc(code, start);
			errors.push({
				...loc,
				severity: "error",
				message: `应用层接口 execute 方法的参数不能超过 2 个，当前有 ${params.length} 个参数。`,
			});
		}
	}

	traverse(parseResult.program, (node) => {
		if (node.type === "MethodDefinition") {
			const isExecute =
				node.key?.type === "Identifier" && node.key.name === "execute";
			if (isExecute && node.value) {
				checkParams(node.value.params || [], node.start);
			}
		}
		if (node.type === "PropertyDefinition") {
			const isExecute =
				node.key?.type === "Identifier" && node.key.name === "execute";
			if (
				isExecute &&
				node.value &&
				(node.value.type === "ArrowFunctionExpression" ||
					node.value.type === "FunctionExpression")
			) {
				checkParams(node.value.params || [], node.start);
			}
		}
	});

	return errors;
}

/** ---------- 规则 3：禁止直接实例化项目内部依赖 ---------- */

function isInternalModuleSpecifier(specifier: string): boolean {
	return (
		specifier.startsWith("./") ||
		specifier.startsWith("../") ||
		specifier.startsWith("@/")
	);
}

export function checkDependencyInjection(
	code: string,
	filepath: string,
): Violation[] {
	const parseResult = parseTs(code, filepath);

	const internalNames = new Set<string>();
	traverse(parseResult.program, (node) => {
		if (node.type === "ClassDeclaration" && node.id?.type === "Identifier") {
			internalNames.add(node.id.name);
			return;
		}
		if (node.type !== "ImportDeclaration") return;
		const source = node.source;
		if (source?.type !== "Literal" || typeof source.value !== "string") return;
		if (!isInternalModuleSpecifier(source.value)) return;
		for (const spec of node.specifiers ?? []) {
			if (spec?.local?.type === "Identifier") {
				internalNames.add(spec.local.name);
			}
		}
	});

	const classes: { name: string; start: number; end: number }[] = [];
	const newExpressions: { callee: string; offset: number }[] = [];

	traverse(parseResult.program, (node) => {
		if (node.type === "ClassDeclaration" && node.id?.type === "Identifier") {
			classes.push({ name: node.id.name, start: node.start, end: node.end });
			return;
		}
		if (
			node.type === "NewExpression" &&
			node.callee?.type === "Identifier" &&
			internalNames.has(node.callee.name)
		) {
			newExpressions.push({ callee: node.callee.name, offset: node.start });
		}
	});

	const errors: Violation[] = [];

	for (const expr of newExpressions) {
		let enclosing: { name: string } | null = null;
		let innermostStart = -1;
		for (const cls of classes) {
			if (
				cls.start <= expr.offset &&
				expr.offset <= cls.end &&
				cls.start > innermostStart
			) {
				enclosing = cls;
				innermostStart = cls.start;
			}
		}

		if (enclosing && enclosing.name === expr.callee) continue;

		const loc = offsetToLoc(code, expr.offset);
		errors.push({
			...loc,
			severity: "error",
			message: `直接实例化了项目内部依赖 "${expr.callee}"，违反依赖注入原则：项目内部依赖必须通过构造函数注入（由 DI 容器装配）。仅第三方库与平台类可在基础设施适配层直接实例化。`,
		});
	}

	return errors;
}

/** ---------- 合并 CLI ---------- */

const rules: CheckRule[] = [
	{
		name: "错误处理",
		targetDirs: [APPLICATION_DIR, INFRASTRUCTURE_DIR],
		includeFile: (f) => isSourceLikeFile(f),
		check: checkErrorHandling,
	},
	{
		name: "应用层参数",
		targetDirs: [APPLICATION_DIR],
		check: checkApplicationParams,
	},
	{
		name: "依赖注入",
		targetDirs: [APPLICATION_DIR, INFRASTRUCTURE_DIR],
		check: checkDependencyInjection,
	},
];

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-application.ts") ||
		process.argv[1].endsWith("check-application.js"))
) {
	runChecks("应用层", rules);
}