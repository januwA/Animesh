import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface ConsoleErrorLocation {
	line: number;
	column: number;
	severity: "error" | "warning";
	message: string;
}

export function checkCode(
	code: string,
	filepath: string,
): ConsoleErrorLocation[] {
	const ext = path.extname(filepath).slice(1);
	const lang = ["js", "jsx", "ts", "tsx"].includes(ext)
		? (ext as "js" | "jsx" | "ts" | "tsx")
		: "ts";

	const parseResult = parseSync(filepath, code, { lang });

	// 如果解析有语法错误，根据错误处理规范，直接抛出或者把错误链传递上去
	if (parseResult.errors && parseResult.errors.length > 0) {
		const errorMsg = parseResult.errors.map((e) => e.message).join("\n");
		throw new Error(`解析文件失败 ${filepath}:\n${errorMsg}`);
	}

	const errors: ConsoleErrorLocation[] = [];

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

	function traverse(
		node: any,
		visit: (
			node: any,
			catchParam: string | null,
			parentKey: string | null,
			parentType: string | null,
		) => void,
		catchParam: string | null = null,
		parentKey: string | null = null,
		parentType: string | null = null,
	) {
		if (!node || typeof node !== "object") return;
		visit(node, catchParam, parentKey, parentType);

		let nextCatchParam = catchParam;
		if (node.type === "CatchClause") {
			nextCatchParam = node.param?.name || null;
		}

		for (const key in node) {
			if (Object.hasOwn(node, key)) {
				const child = node[key];
				if (Array.isArray(child)) {
					for (const item of child) {
						traverse(item, visit, nextCatchParam, key, node.type);
					}
				} else if (child && typeof child === "object") {
					traverse(child, visit, nextCatchParam, key, node.type);
				}
			}
		}
	}

	function isValidCauseOptions(arg: any, catchParam: string): boolean {
		if (!arg || arg.type !== "ObjectExpression") return false;
		const props = arg.properties || [];
		return props.some((prop: any) => {
			if (prop.type !== "ObjectProperty" && prop.type !== "Property")
				return false;
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
				// 遇到嵌套 catch，其内部 throw 属于内层，对外层无效，故跳过
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

	traverse(parseResult.program, (node, catchParam, parentKey, parentType) => {
		// 1. 全面禁用 console 的检查 (通过拦截除了声明/属性名之外的所有 Identifier)
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

		// 2. 检查 catch 块错误重新包装是否保留 cause
		if (node.type === "ThrowStatement" && catchParam) {
			const arg = node.argument;
			if (arg) {
				// 如果是直接 throw 捕获的错误本身，是允许的
				const isThrowingParamDirectly =
					arg.type === "Identifier" && arg.name === catchParam;
				if (!isThrowingParamDirectly) {
					// 如果是包装了新错误，必须是 NewExpression，且第二个参数对象内包含 { cause: catchParam }
					if (arg.type === "NewExpression") {
						const args = arg.arguments || [];
						const hasValidCause =
							args.length >= 2 && isValidCauseOptions(args[1], catchParam);
						if (!hasValidCause) {
							const loc = offsetToLoc(code, node.start);
							errors.push({
								...loc,
								severity: "error",
								message:
									"重新包装抛出新错误时，必须使用 { cause: err } 选项保留原始错误链。",
							});
						}
					} else {
						// 其他抛出（比如 throw "string" 等）也都视作丢弃了原始错误链
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

		// 3. 检查 catch 块中是否吞掉了错误（未抛出任何异常）
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

function globFiles(dir: string): string[] {
	const results: string[] = [];
	if (!fs.existsSync(dir)) return results;
	const list = fs.readdirSync(dir);
	for (const file of list) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat && stat.isDirectory()) {
			results.push(...globFiles(filePath));
		} else if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file)) {
			results.push(filePath);
		}
	}
	return results;
}

// 只有直接执行本脚本时才运行 CLI 逻辑
if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-error-handling.ts") ||
		process.argv[1].endsWith("check-error-handling.js"))
) {
	main();
}

function main() {
	const args = process.argv
		.slice(2)
		.flatMap((f) => f.split(/\s+/))
		.filter(Boolean);

	// 目标扫描的两个层级
	const targetDirs = ["src/application", "src/infrastructure"].map((d) =>
		path.resolve(process.cwd(), d),
	);

	let filesToCheck: string[] = [];

	if (args.length > 0) {
		// 过滤出传入的且属于目标目录的源文件
		filesToCheck = args
			.map((f) => path.resolve(process.cwd(), f))
			.filter((f) => {
				const isUnderTarget = targetDirs.some((dir) => f.startsWith(dir));
				const isSourceFile = /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(f);
				return isUnderTarget && isSourceFile && fs.existsSync(f);
			});
	} else {
		// 默认全量扫描
		filesToCheck = targetDirs.flatMap((dir) => globFiles(dir));
	}

	if (filesToCheck.length === 0) {
		console.log("未检测到需要检查的代码文件。");
		process.exit(0);
	}

	let totalErrors = 0;
	let totalWarnings = 0;

	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		const relativePath = path.relative(process.cwd(), file);
		const violations = checkCode(code, file);
		if (violations.length > 0) {
			for (const loc of violations) {
				if (loc.severity === "error") {
					totalErrors++;
					console.error(
						`❌ 错误: ${relativePath}:${loc.line}:${loc.column} - ${loc.message}`,
					);
				} else {
					totalWarnings++;
					console.warn(
						`⚠️ 警告: ${relativePath}:${loc.line}:${loc.column} - ${loc.message}`,
					);
				}
			}
		}
	}

	if (totalErrors > 0) {
		console.error(
			`\n🛑 校验未通过：发现了 ${totalErrors} 处严重错误（及 ${totalWarnings} 处警告）。请务必遵循错误处理规范进行修正。`,
		);
		process.exit(1);
	} else if (totalWarnings > 0) {
		console.warn(
			`\n⚠️ 校验通过，但有 ${totalWarnings} 处警示：请检查上述警告处是否确属合法的降级逻辑，并尽量避免半路吞掉错误。`,
		);
		process.exit(0);
	} else {
		console.log(
			"✨ 未发现任何违规。",
		);
		process.exit(0);
	}
}
