import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface ImportErrorLocation {
	line: number;
	column: number;
	severity: "error";
	message: string;
}

export function checkCode(
	code: string,
	filepath: string,
): ImportErrorLocation[] {
	const ext = path.extname(filepath).slice(1);
	const lang = ["js", "jsx", "ts", "tsx"].includes(ext)
		? (ext as "js" | "jsx" | "ts" | "tsx")
		: "ts";

	const parseResult = parseSync(filepath, code, { lang });

	if (parseResult.errors && parseResult.errors.length > 0) {
		const errorMsg = parseResult.errors.map((e) => e.message).join("\n");
		throw new Error(`解析文件失败 ${filepath}:\n${errorMsg}`);
	}

	const errors: ImportErrorLocation[] = [];

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

	const isTauriImport = (sourceNode: any) => {
		if (sourceNode && (sourceNode.type === "StringLiteral" || sourceNode.type === "Literal")) {
			const val = sourceNode.value;
			return typeof val === "string" && (val === "@tauri-apps" || val.startsWith("@tauri-apps/"));
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
	(process.argv[1].endsWith("check-presentation-tauri-imports.ts") ||
		process.argv[1].endsWith("check-presentation-tauri-imports.js"))
) {
	main();
}

function main() {
	const args = process.argv
		.slice(2)
		.flatMap((f) => f.split(/\s+/))
		.filter(Boolean);

	// 目标扫描层级：仅表现层
	const targetDirs = ["src/presentation"].map((d) =>
		path.resolve(process.cwd(), d),
	);

	let filesToCheck: string[] = [];

	if (args.length > 0) {
		// 过滤出传入的且属于目标目录的源文件，排除测试文件
		filesToCheck = args
			.map((f) => path.resolve(process.cwd(), f))
			.filter((f) => {
				const isUnderTarget = targetDirs.some((dir) => f.startsWith(dir));
				const isSourceFile = /\.(js|jsx|ts|tsx)$/.test(f);
				const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(f);
				return isUnderTarget && isSourceFile && !isTestFile && fs.existsSync(f);
			});
	} else {
		// 默认全量扫描
		filesToCheck = targetDirs.flatMap((dir) => globFiles(dir));
	}

	if (filesToCheck.length === 0) {
		console.log("未检测到需要检查的表现层代码文件。");
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
			`\n🛑 校验未通过：在 src/presentation 中发现了 ${totalErrors} 处非法的 Tauri 依赖导入。表现层组件应保持平台无关性，请使用 DI 进行隔离。`,
		);
		process.exit(1);
	} else {
		console.log("✨ 未在 src/presentation 中发现任何非法的 Tauri 依赖导入。");
		process.exit(0);
	}
}
