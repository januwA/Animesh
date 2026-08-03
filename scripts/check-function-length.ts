import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface LengthErrorLocation {
	line: number;
	column: number;
	severity: "error";
	message: string;
}

/** 一个跨多行的纯数据字面量所占的行区间（0 起始，含起止）。 */
interface LineSpan {
	startLine: number;
	endLine: number;
}

function countLogicalLines(funcText: string, dataSpans: LineSpan[] = []): number {
	const lines = funcText.split(/\r?\n/);
	let count = 0;
	let inBlockComment = false;
	let spanIdx = 0;

	for (let li = 0; li < lines.length; li++) {
		const line = lines[li].trim();
		if (!line) continue;

		// 多行纯数据字面量的内部行与结束行不重复计数，起点行已按 1 行计入
		while (spanIdx < dataSpans.length && li > dataSpans[spanIdx].endLine) {
			spanIdx++;
		}
		if (spanIdx < dataSpans.length) {
			const span = dataSpans[spanIdx];
			if (li > span.startLine && li <= span.endLine) {
				if (li === span.endLine) spanIdx++;
				continue;
			}
		}

		if (inBlockComment) {
			if (line.includes("*/")) {
				inBlockComment = false;
			}
			continue;
		}
		if (line.startsWith("/*")) {
			if (!line.includes("*/")) {
				inBlockComment = true;
			}
			continue;
		}
		if (line.startsWith("//")) {
			continue;
		}

		count++;
	}

	return count;
}

export function checkCode(
	code: string,
	filepath: string,
): LengthErrorLocation[] {
	const ext = path.extname(filepath).slice(1);
	const lang = ["js", "jsx", "ts", "tsx"].includes(ext)
		? (ext as "js" | "jsx" | "ts" | "tsx")
		: "ts";

	const parseResult = parseSync(filepath, code, { lang });

	if (parseResult.errors && parseResult.errors.length > 0) {
		const errorMsg = parseResult.errors.map((e) => e.message).join("\n");
		throw new Error(`解析文件失败 ${filepath}:\n${errorMsg}`);
	}

	const errors: LengthErrorLocation[] = [];

	// 所有行首偏移，用于 offset -> 0 起始行号的快速转换
	const lineStarts = [0];
	for (let i = 0; i < code.length; i++) {
		if (code[i] === "\n") lineStarts.push(i + 1);
	}

	function lineOf(offset: number): number {
		let lo = 0;
		let hi = lineStarts.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (lineStarts[mid] <= offset) lo = mid;
			else hi = mid - 1;
		}
		return lo;
	}

	// 是否为"纯数据字面量"：内部只包含字面量、纯数据数组/对象，不含标识符、
	// 函数体、展开等表达式。格式化器可能将其逐行展开，逻辑上应视为 1 行。
	function isPureDataLiteral(node: any): boolean {
		if (!node || typeof node !== "object") return false;
		switch (node.type) {
			case "Literal":
				return true;
			case "ArrayExpression":
				return node.elements.every(
					(el: any) => el !== null && isPureDataLiteral(el),
				);
			case "ObjectExpression":
				return node.properties.every(
					(prop: any) =>
						prop.type === "Property" &&
						!prop.method &&
						!prop.shorthand &&
						!prop.computed &&
						isPureDataLiteral(prop.value),
				);
			case "TemplateLiteral":
				return node.expressions.length === 0;
			case "UnaryExpression":
				// 支持负数等一元字面量，如 [-1, -2.5]
				return (
					(node.operator === "-" || node.operator === "+") &&
					isPureDataLiteral(node.argument)
				);
			default:
				return false;
		}
	}

	// 收集 body 内所有跨多行的纯数据字面量行区间（0 起始），命中后剪枝避免嵌套区间
	function collectDataSpans(node: any, spans: LineSpan[]): void {
		if (!node || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const item of node) collectDataSpans(item, spans);
			return;
		}
		if (
			node.type === "ArrayExpression" ||
			node.type === "ObjectExpression" ||
			node.type === "TemplateLiteral"
		) {
			if (isPureDataLiteral(node)) {
				const startLine = lineOf(node.start);
				const endLine = lineOf(node.end);
				if (endLine > startLine) {
					spans.push({ startLine, endLine });
				}
				return;
			}
		}
		for (const key in node) {
			if (Object.hasOwn(node, key)) {
				const child = node[key];
				if (Array.isArray(child)) {
					for (const item of child) collectDataSpans(item, spans);
				} else if (child && typeof child === "object") {
					collectDataSpans(child, spans);
				}
			}
		}
	}

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

	function getFunctionName(node: any, parent: any): string {
		if (node.type === "FunctionDeclaration") {
			return node.id?.name || "anonymous";
		}
		if (node.type === "MethodDefinition") {
			return node.key?.name || node.key?.value || "anonymous";
		}
		if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
			if (parent) {
				if (parent.type === "VariableDeclarator") {
					return parent.id?.name || "anonymous";
				}
				if (parent.type === "PropertyDefinition") {
					return parent.key?.name || parent.key?.value || "anonymous";
				}
				if (parent.type === "Property" || parent.type === "ObjectProperty") {
					return parent.key?.name || parent.key?.value || "anonymous";
				}
			}
		}
		return "anonymous";
	}

	function traverse(node: any, parent: any = null) {
		if (!node || typeof node !== "object") return;

		let isFunctionNode = false;
		let checkNode = node;

		if (node.type === "FunctionDeclaration") {
			// 仅检查有函数体的函数（忽略类型声明、重载签名）
			if (node.body) {
				isFunctionNode = true;
			}
		} else if (node.type === "MethodDefinition") {
			// MethodDefinition 包含 value (FunctionExpression)
			if (node.value && node.value.body) {
				isFunctionNode = true;
			}
		} else if (node.type === "ArrowFunctionExpression") {
			isFunctionNode = true;
		} else if (node.type === "FunctionExpression") {
			// 避免在 MethodDefinition 中重复检查其 value (FunctionExpression)
			if (!parent || parent.type !== "MethodDefinition") {
				isFunctionNode = true;
			}
		}

		if (isFunctionNode) {
			const bodyNode = checkNode.type === "MethodDefinition"
				? checkNode.value?.body
				: checkNode.body;

			if (bodyNode) {
				const startLoc = offsetToLoc(code, checkNode.start);
				const isBlock = bodyNode.type === "BlockStatement";
				const sliceStart = isBlock ? bodyNode.start + 1 : bodyNode.start;
				const sliceEnd = isBlock ? bodyNode.end - 1 : bodyNode.end;
				const bodyText = code.slice(sliceStart, sliceEnd);
				const bodyStartLine = lineOf(sliceStart);
				const spans: LineSpan[] = [];
				collectDataSpans(bodyNode, spans);
				const relSpans = spans.map((span) => ({
					startLine: span.startLine - bodyStartLine,
					endLine: span.endLine - bodyStartLine,
				}));
				const lineCount = countLogicalLines(bodyText, relSpans);

				if (lineCount > 30) {
					const name = getFunctionName(checkNode, parent);
					const label = checkNode.type === "MethodDefinition" ? "方法" : "函数";
					errors.push({
						...startLoc,
						severity: "error",
						message: `${label} ${name} 的函数体逻辑长度为 ${lineCount} 行，超过了 30 行的最大限制（已过滤定义签名、注释及空行）。`,
					});
				}
			}
		}

		// 递归遍历子节点
		for (const key in node) {
			if (Object.hasOwn(node, key)) {
				const child = node[key];
				if (Array.isArray(child)) {
					for (const item of child) {
						traverse(item, node);
					}
				} else if (child && typeof child === "object") {
					traverse(child, node);
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
	(process.argv[1].endsWith("check-function-length.ts") ||
		process.argv[1].endsWith("check-function-length.js"))
) {
	main();
}

function main() {
	const args = process.argv
		.slice(2)
		.flatMap((f) => f.split(/\s+/))
		.filter(Boolean);

	// 目标扫描的层级
	const targetDirs = [
		"src/application",
		"src/crosscutting",
		"src/domain",
		"src/infrastructure",
	].map((d) => path.resolve(process.cwd(), d));

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
		console.log("未检测到需要检查函数长度的代码文件。");
		process.exit(0);
	}

	let totalErrors = 0;

	for (const file of filesToCheck) {
		const code = fs.readFileSync(file, "utf8");
		const relativePath = path.relative(process.cwd(), file);
		try {
			const violations = checkCode(code, file);
			if (violations.length > 0) {
				for (const loc of violations) {
					totalErrors++;
					console.error(
						`❌ 错误: ${relativePath}:${loc.line}:${loc.column} - ${loc.message}`,
					);
				}
			}
		} catch (err: any) {
			console.error(`解析文件失败 ${relativePath}:`, err.message);
			process.exit(1);
		}
	}

	if (totalErrors > 0) {
		console.error(
			`\n🛑 校验未通过：在指定目录中发现了 ${totalErrors} 处函数/方法长度超过 30 行的错误。请进行重构以提升可读性和可维护性。`,
		);
		process.exit(1);
	} else {
		console.log("✨ 所有目标目录中的函数和方法长度均在 30 行以内。");
		process.exit(0);
	}
}
