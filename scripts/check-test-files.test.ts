import { describe, expect, it } from "vitest";
import {
	hasMatchingTest,
	isDeclarationFile,
	isExemptFile,
	isPageIndexTestFile,
	isSourceFile,
	isTestFile,
} from "./check-test-files";

describe("check-test-files 测试文件组织检查", () => {
	describe("hasMatchingTest 同名测试匹配", () => {
		it("存在同名 .test.ts 时匹配成功", () => {
			expect(
				hasMatchingTest("SearchForm", ["SearchForm.test.ts", "SearchForm.tsx"]),
			).toBe(true);
		});

		it("存在同名 .test.tsx 时匹配成功", () => {
			expect(
				hasMatchingTest("SearchForm", ["SearchForm.test.tsx", "SearchForm.tsx"]),
			).toBe(true);
		});

		it("缺少同名测试时匹配失败", () => {
			expect(
				hasMatchingTest("SearchForm", ["SearchHistory.test.tsx"]),
			).toBe(false);
		});

		it("只匹配同目录文件，不匹配其他目录的同名测试", () => {
			expect(
				hasMatchingTest("utils", ["utils.test.ts", "other.utils.test.ts"]),
			).toBe(true);
		});
	});

	describe("isPageIndexTestFile 禁止的页面集中测试", () => {
		it("识别 pages 目录下的 index.test.tsx", () => {
			expect(
				isPageIndexTestFile(
					"src/presentation/pages/TorrentSearch/index.test.tsx",
				),
			).toBe(true);
		});

		it("识别 pages 目录下的 index.test.ts", () => {
			expect(
				isPageIndexTestFile("src/presentation/pages/Player/index.test.ts"),
			).toBe(true);
		});

		it("不识别非 pages 目录的 index.test.tsx", () => {
			expect(isPageIndexTestFile("src/application/index.test.ts")).toBe(false);
		});

		it("不识别页面入口 index.tsx 本身", () => {
			expect(
				isPageIndexTestFile("src/presentation/pages/Player/index.tsx"),
			).toBe(false);
		});

		it("不识别深层嵌套目录的 index.test.tsx", () => {
			expect(
				isPageIndexTestFile(
					"src/presentation/pages/Player/components/index.test.tsx",
				),
			).toBe(false);
		});
	});

	describe("isExemptFile 覆盖率豁免文件", () => {
		it("豁免页面入口 index.tsx", () => {
			expect(
				isExemptFile("src/presentation/pages/Settings/index.tsx"),
			).toBe(true);
		});

		it("豁免 ui 组件库目录", () => {
			expect(isExemptFile("src/presentation/components/ui/button.tsx")).toBe(
				true,
			);
			expect(
				isExemptFile("src/presentation/components/ui/button/index.tsx"),
			).toBe(true);
		});

		it("豁免 App.tsx 与 MpegtsVideo.tsx", () => {
			expect(isExemptFile("src/presentation/App.tsx")).toBe(true);
			expect(isExemptFile("src/presentation/components/MpegtsVideo.tsx")).toBe(
				true,
			);
		});

		it("不豁免普通组件与 hook", () => {
			expect(isExemptFile("src/presentation/components/Layout.tsx")).toBe(
				false,
			);
			expect(isExemptFile("src/presentation/hooks/useQuery.ts")).toBe(false);
			expect(
				isExemptFile("src/presentation/pages/Player/player.ts"),
			).toBe(false);
		});

		it("不豁免 application 目录文件", () => {
			expect(
				isExemptFile("src/application/torrent/SearchTorrentsUseCase.ts"),
			).toBe(false);
		});
	});

	describe("文件名识别", () => {
		it("识别测试文件", () => {
			expect(isTestFile("SearchForm.test.tsx")).toBe(true);
			expect(isTestFile("PathUtils.test.ts")).toBe(true);
			expect(isTestFile("bump-version.spec.ts")).toBe(true);
		});

		it("不把普通源码当测试文件", () => {
			expect(isTestFile("SearchForm.tsx")).toBe(false);
			expect(isTestFile("index.tsx")).toBe(false);
		});

		it("识别 .d.ts 声明文件", () => {
			expect(isDeclarationFile("vite-env.d.ts")).toBe(true);
			expect(isDeclarationFile("types.d.ts")).toBe(true);
		});

		it("识别源码文件", () => {
			expect(isSourceFile("useQuery.ts")).toBe(true);
			expect(isSourceFile("SearchForm.tsx")).toBe(true);
			expect(isSourceFile("utils.test.ts")).toBe(true);
			expect(isSourceFile("logo.png")).toBe(false);
		});
	});
});