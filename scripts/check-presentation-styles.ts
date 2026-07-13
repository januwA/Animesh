import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface StyleErrorLocation {
	line: number;
	column: number;
	severity: "error";
	message: string;
}

// Regex to detect forbidden layout color utilities (hardcoded white/black background/border, or hardcoded color opacity)
const FORBIDDEN_STYLE_REGEX = /\b(?:bg|border|outline|ring|divide)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|border|outline|ring|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\/\d+/g;

export function checkCode(
	code: string,
	filepath: string,
): StyleErrorLocation[] {
	const ext = path.extname(filepath).slice(1);
	const lang = ["js", "jsx", "ts", "tsx"].includes(ext)
		? (ext as "js" | "jsx" | "ts" | "tsx")
		: "ts";

	const parseResult = parseSync(filepath, code, { lang });

	if (parseResult.errors && parseResult.errors.length > 0) {
		const errorMsg = parseResult.errors.map((e) => e.message).join("\n");
		throw new Error(`解析文件失败 ${filepath}:\n${errorMsg}`);
	}

	const errors: StyleErrorLocation[] = [];
	const lines = code.split("\n");

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
				// Check if the line OR adjacent lines (±3) contain a "style-ignore" comment
				// This is needed because biome may reformat JSX {/* style-ignore */} to a sibling line,
				// sometimes inserting additional nodes (e.g. {" "}) in between.
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

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-presentation-styles.ts") ||
		process.argv[1].endsWith("check-presentation-styles.js"))
) {
	main();
}

function main() {
	const args = process.argv
		.slice(2)
		.flatMap((f) => f.split(/\s+/))
		.filter(Boolean);

	const targetDirs = ["src/presentation"].map((d) =>
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
	} else {
		filesToCheck = targetDirs.flatMap((dir) => globFiles(dir));
	}

	if (filesToCheck.length === 0) {
		console.log("未检测到需要检查样式的表现层文件。");
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
			`\n🛑 校验未通过：在表现层样式中发现了 ${totalErrors} 处非法的硬编码色彩或透明度。请使用语义化 CSS 变量进行适配。`,
		);
		process.exit(1);
	} else {
		console.log("✨ 表现层样式检查通过。未发现任何非法的硬编码样式类。");
		process.exit(0);
	}
}
