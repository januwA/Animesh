import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface ParamErrorLocation {
	line: number;
	column: number;
	severity: "error";
	message: string;
}

export function checkCode(
	code: string,
	filepath: string,
): ParamErrorLocation[] {
	const ext = path.extname(filepath).slice(1);
	const lang = ["js", "jsx", "ts", "tsx"].includes(ext)
		? (ext as "js" | "jsx" | "ts" | "tsx")
		: "ts";

	const parseResult = parseSync(filepath, code, { lang });

	if (parseResult.errors && parseResult.errors.length > 0) {
		const errorMsg = parseResult.errors.map((e) => e.message).join("\n");
		throw new Error(`解析文件失败 ${filepath}:\n${errorMsg}`);
	}

	const errors: ParamErrorLocation[] = [];

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

	function traverse(node: any) {
		if (!node || typeof node !== "object") return;

		// 检查类方法
		if (node.type === "MethodDefinition") {
			const isExecute =
				node.key &&
				node.key.type === "Identifier" &&
				node.key.name === "execute";
			if (isExecute && node.value) {
				const params = node.value.params || [];
				if (params.length > 2) {
					const loc = offsetToLoc(code, node.start);
					errors.push({
						...loc,
						severity: "error",
						message: `应用层接口 execute 方法的参数不能超过 2 个，当前有 ${params.length} 个参数。`,
					});
				}
			}
		}

		// 检查类属性定义的 execute 箭头函数 / 函数表达式
		if (node.type === "PropertyDefinition") {
			const isExecute =
				node.key &&
				node.key.type === "Identifier" &&
				node.key.name === "execute";
			if (
				isExecute &&
				node.value &&
				(node.value.type === "ArrowFunctionExpression" ||
					node.value.type === "FunctionExpression")
			) {
				const params = node.value.params || [];
				if (params.length > 2) {
					const loc = offsetToLoc(code, node.start);
					errors.push({
						...loc,
						severity: "error",
						message: `应用层接口 execute 方法的参数不能超过 2 个，当前有 ${params.length} 个参数。`,
					});
				}
			}
		}

		for (const key in node) {
			if (Object.hasOwn(node, key)) {
				const child = node[key];
				if (Array.isArray(child)) {
					for (const item of child) {
						traverse(item);
					}
				} else if (child && typeof child === "object") {
					traverse(child);
				}
			}
		}
	}

	traverse(parseResult.program);

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
			// 排除测试文件
			if (!/\.(test|spec)\.[jt]sx?$/.test(file)) {
				results.push(filePath);
			}
		}
	}
	return results;
}

// CLI 逻辑
if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-application-params.ts") ||
		process.argv[1].endsWith("check-application-params.js"))
) {
	main();
}

function main() {
	const args = process.argv
		.slice(2)
		.flatMap((f) => f.split(/\s+/))
		.filter(Boolean);

	// 目标扫描的层级：仅应用层
	const targetDirs = ["src/application"].map((d) =>
		path.resolve(process.cwd(), d),
	);

	let filesToCheck: string[] = [];

	if (args.length > 0) {
		// 过滤出传入的且属于目标目录的源文件，排除测试文件
		filesToCheck = args
			.map((f) => path.resolve(process.cwd(), f))
			.filter((f) => {
				const isUnderTarget = targetDirs.some((dir) => f.startsWith(dir));
				const isSourceFile = /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(f);
				const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(f);
				return isUnderTarget && isSourceFile && !isTestFile && fs.existsSync(f);
			});
	} else {
		// 默认全量扫描
		filesToCheck = targetDirs.flatMap((dir) => globFiles(dir));
	}

	if (filesToCheck.length === 0) {
		console.log("未检测到需要检查的应用层接口代码文件。");
		process.exit(0);
	}

	let totalErrors = 0;

	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		const relativePath = path.relative(process.cwd(), file);
		const violations = checkCode(code, file);
		if (violations.length > 0) {
			for (const loc of violations) {
				totalErrors++;
				console.error(
					`❌ 错误: ${relativePath}:${loc.line}:${loc.column} - ${loc.message}`,
				);
			}
		}
	}

	if (totalErrors > 0) {
		console.error(
			`\n🛑 校验未通过：发现了 ${totalErrors} 处接口设计错误（execute 参数超过 2 个）。请重构为 execute(ctx, dto) 形式。`,
		);
		process.exit(1);
	} else {
		console.log("✨ 未发现任何接口设计违规。");
		process.exit(0);
	}
}
