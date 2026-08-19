import fs from "node:fs";
import path from "node:path";

const TARGET_DIRS = [
	"src/application",
	"src/crosscutting",
	"src/presentation",
];

/** 与 vite.config.ts 中 coverage.exclude 对齐的豁免路径（这些文件不参与覆盖率，无需同名测试） */
const EXEMPT_PATTERNS = [
	/^src\/presentation\/pages\/[^/]+\/index\.tsx$/,
	/^src\/presentation\/components\/ui\//,
	/^src\/presentation\/App\.tsx$/,
	/^src\/presentation\/routes\.tsx$/,
	/^src\/presentation\/components\/MpegtsVideo\.tsx$/,
];

/** 禁止存在的页面测试文件：避免把单测全部塞进 index.test.tsx */
const FORBIDDEN_PAGE_TEST_PATTERN =
	/^src\/presentation\/pages\/[^/]+\/index\.test\.[jt]sx?$/;

export interface TestFileViolation {
	relativePath: string;
	message: string;
}

function normalizePath(filepath: string): string {
	return filepath.replace(/\\/g, "/");
}

export function isTestFile(basename: string): boolean {
	return /\.(test|spec)\.[jt]sx?$/.test(basename);
}

export function isDeclarationFile(basename: string): boolean {
	return /\.d\.ts$/.test(basename);
}

export function isSourceFile(basename: string): boolean {
	return /\.(js|jsx|ts|tsx)$/.test(basename);
}

export function isExemptFile(relativePath: string): boolean {
	return EXEMPT_PATTERNS.some((pattern) => pattern.test(relativePath));
}

/** 判断是否为被禁止的页面入口集中测试文件 */
export function isPageIndexTestFile(relativePath: string): boolean {
	return FORBIDDEN_PAGE_TEST_PATTERN.test(relativePath);
}

/** 判断同目录测试文件中是否存在与 base 同名的测试（a → a.test.ts / a.test.tsx） */
export function hasMatchingTest(
	base: string,
	testBasenames: string[],
): boolean {
	return testBasenames.some(
		(name) => name === `${base}.test.ts` || name === `${base}.test.tsx`,
	);
}

function listDir(dir: string): string[] {
	try {
		return fs.readdirSync(dir);
	} catch {
		return [];
	}
}

/** 检查单个源码文件是否有同目录的同名测试文件 */
export function findMissingSameNameTest(
	filepath: string,
	dir: string,
): TestFileViolation | null {
	const basename = path.basename(filepath);
	const base = basename.replace(/\.(js|jsx|ts|tsx)$/, "");
	if (!hasMatchingTest(base, listDir(dir))) {
		const relativePath = normalizePath(path.relative(process.cwd(), filepath));
		return {
			relativePath,
			message: `缺少同名测试文件 ${base}.test.ts(x)，每个源码文件必须与同目录的同名测试文件一一对应。`,
		};
	}
	return null;
}

function globSourceFiles(dir: string): string[] {
	const results: string[] = [];
	if (!fs.existsSync(dir)) return results;
	for (const file of fs.readdirSync(dir)) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			results.push(...globSourceFiles(filePath));
		} else if (
			isSourceFile(file) &&
			!isTestFile(file) &&
			!isDeclarationFile(file)
		) {
			results.push(filePath);
		}
	}
	return results;
}

/** 全量扫描目标目录，返回规则1与规则2的全部违规 */
export function collectViolations(): TestFileViolation[] {
	const violations: TestFileViolation[] = [];
	const seen = new Set<string>();

	const targetRoots = TARGET_DIRS.map((d) => path.resolve(process.cwd(), d));

	for (const dir of TARGET_DIRS) {
		for (const file of globSourceFiles(path.resolve(process.cwd(), dir))) {
			const relativePath = normalizePath(path.relative(process.cwd(), file));
			if (seen.has(relativePath)) continue;
			seen.add(relativePath);
if (isExemptFile(relativePath)) continue;
			const violation = findMissingSameNameTest(file, path.dirname(file));
			if (violation) violations.push(violation);
		}
	}

	// 规则2：禁止 pages 目录下的 index.test.tsx
	for (const root of targetRoots) {
		for (const file of globTestFiles(root)) {
			const relativePath = normalizePath(path.relative(process.cwd(), file));
			if (FORBIDDEN_PAGE_TEST_PATTERN.test(relativePath)) {
				violations.push({
					relativePath,
					message: `页面入口的测试不得集中写在 index.test.tsx 中，请将测试拆分到各组件/hook 的同名测试文件。`,
				});
			}
		}
	}

	return violations;
}

function globTestFiles(dir: string): string[] {
	const results: string[] = [];
	if (!fs.existsSync(dir)) return results;
	for (const file of fs.readdirSync(dir)) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			results.push(...globTestFiles(filePath));
		} else if (isTestFile(file)) {
			results.push(filePath);
		}
	}
	return results;
}

/** 仅检查传入的文件列表（供 lefthook push_files 使用） */
export function collectViolationsForFiles(files: string[]): TestFileViolation[] {
	const violations: TestFileViolation[] = [];

	for (const f of files) {
		const filepath = path.resolve(process.cwd(), f);
		const relativePath = normalizePath(path.relative(process.cwd(), filepath));

		// 规则2：改动或新增页面 index.test.tsx 一律禁止
		if (FORBIDDEN_PAGE_TEST_PATTERN.test(relativePath)) {
			violations.push({
				relativePath,
				message: `页面入口的测试不得集中写在 index.test.tsx 中，请将测试拆分到各组件/hook 的同名测试文件。`,
			});
			continue;
		}

		const basename = path.basename(filepath);
		if (!fs.existsSync(filepath)) continue;
		if (isTestFile(basename) || isDeclarationFile(basename)) continue;
		if (!isSourceFile(basename)) continue;

		const underTarget = TARGET_DIRS.some((d) => {
			const root = path.resolve(process.cwd(), d);
			return filepath.startsWith(root);
		});
		if (!underTarget) continue;
		if (isExemptFile(relativePath)) continue;

		const violation = findMissingSameNameTest(filepath, path.dirname(filepath));
		if (violation) violations.push(violation);
	}

	return violations;
}

function printViolations(violations: TestFileViolation[]): void {
	for (const violation of violations) {
		console.error(`❌ ${violation.relativePath} - ${violation.message}`);
	}
}

function main() {
	const args = process.argv
		.slice(2)
		.flatMap((f) => f.split(/\s+/))
		.filter(Boolean);

	const violations =
		args.length > 0
			? collectViolationsForFiles(args)
			: collectViolations();

	if (violations.length > 0) {
		printViolations(violations);
		console.error(
			`\n🛑 校验未通过：发现了 ${violations.length} 处测试文件组织违规。请确保每个源码文件都有同目录同名测试文件，且页面测试不得集中在 index.test.tsx。`,
		);
		process.exit(1);
	} else {
		console.log("✨ 测试文件组织规范校验通过：源码文件与同名测试文件一一对应。");
		process.exit(0);
	}
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-test-files.ts") ||
		process.argv[1].endsWith("check-test-files.js"))
) {
	main();
}