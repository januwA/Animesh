import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface DepsErrorLocation {
	line: number;
	column: number;
	severity: "error";
	message: string;
}

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

function keyName(key: any): string | null {
	if (key?.type === "Identifier") return key.name;
	if (key?.type === "Literal" && typeof key.value === "string") return key.value;
	return null;
}

/**
 * 判断属性类型是否为 Pick<XxxUseCase, "execute">：
 * TS 类型引用类型名必须为 Pick，且恰好两个类型参数，
 * 第一个为标识符类型引用，第二个为字符串字面量 "execute"。
 */
export function isPickExecuteType(typeNode: any): boolean {
	if (typeNode?.type !== "TSTypeReference") return false;
	if (typeNode.typeName?.type !== "Identifier") return false;
	if (typeNode.typeName.name !== "Pick") return false;
	const args = typeNode.typeArguments?.params ?? typeNode.typeArguments?.typeParameters?.params ?? [];
	if (args.length !== 2) return false;
	if (args[0]?.type !== "TSTypeReference") return false;
	const second = args[1];
	if (second?.type !== "TSLiteralType") return false;
	if (second.literal?.type !== "Literal") return false;
	return second.literal.value === "execute";
}

/**
 * 检查表现层 deps 接口规范：
 * 以 *Deps 结尾的接口/类型别名的每个属性，必须用 Pick<UseCase, "execute"> 声明，
 * 使测试可直接传 { execute: vi.fn() } 而无需 cast。
 */
export function checkCode(code: string, filepath: string): DepsErrorLocation[] {
	const parseResult = parseTs(code, filepath);
	const errors: DepsErrorLocation[] = [];

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
			`\n🛑 校验未通过：发现了 ${totalErrors} 处 deps 接口声明违规。请使用 Pick<UseCase, "execute"> 声明 deps 接口属性。`,
		);
		process.exit(1);
	} else {
		console.log("✨ 表现层 deps 接口 Pick 声明规范校验通过。");
		process.exit(0);
	}
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-presentation-deps.ts") ||
		process.argv[1].endsWith("check-presentation-deps.js"))
) {
	main();
}