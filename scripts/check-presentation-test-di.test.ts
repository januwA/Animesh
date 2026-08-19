import { describe, expect, it } from "vitest";
import {
	checkCode,
	isHookTestFile,
	isPageTestFile,
} from "./check-presentation-test-di";

const ROOT = process.cwd();
const PAGE_DIR = `${ROOT}/src/presentation/pages`;

describe("isHookTestFile / isPageTestFile", () => {
	it("useXxx.test.tsx 属于 hook 级单测", () => {
		expect(isHookTestFile(`${PAGE_DIR}/Settings/useSettingsPage.test.tsx`)).toBe(
			true,
		);
	});

	it("index.test.tsx 属于页面级集成测试", () => {
		expect(isPageTestFile(`${PAGE_DIR}/Player/index.test.tsx`)).toBe(true);
	});

	it("单文件页面测试不属于页面级集成测试", () => {
		expect(isPageTestFile(`${PAGE_DIR}/Calendar.test.tsx`)).toBe(false);
	});

	it("普通组件测试文件两种分类均不匹配", () => {
		expect(
			isHookTestFile(`${ROOT}/src/presentation/components/Button.test.tsx`),
		).toBe(false);
		expect(
			isPageTestFile(`${ROOT}/src/presentation/components/Button.test.tsx`),
		).toBe(false);
	});
});

describe("checkCode hook 级单测 DI 规范", () => {
	const hookTestPath = `${PAGE_DIR}/Settings/useSettingsPage.test.tsx`;

	it("使用 createDIContainerForTest 应当报错", () => {
		const code = `
import { createDIContainerForTest } from "@/test/test-utils";
import { renderHook } from "@testing-library/react";
import { useSettingsPage } from "./useSettingsPage";
`;
		const errors = checkCode(code, hookTestPath);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			severity: "error",
			message: expect.stringContaining("createDIContainerForTest"),
		});
	});

	it("直接传 mock deps 且未使用 createDIContainerForTest 应当通过", () => {
		const code = `
import { renderHook } from "@testing-library/react";
import { useSettingsPage } from "./useSettingsPage";
`;
		const errors = checkCode(code, hookTestPath);
		expect(errors).toHaveLength(0);
	});
});

describe("checkCode 页面级集成测试 DI 规范", () => {
	const pageTestPath = `${PAGE_DIR}/Player/index.test.tsx`;
	const options = { siblingUsesUseDI: true };

	it("使用 DIProvider + as unknown as DIContainer 且未用 createDIContainerForTest 应当通过", () => {
		const code = `
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";

const container = {
  getTorrentStreamUrlUseCase: { execute: vi.fn() },
} as unknown as DIContainer;

render(
  <DIProvider value={container}>
    <PlayerView />
  </DIProvider>,
);
`;
		const errors = checkCode(code, pageTestPath, options);
		expect(errors).toHaveLength(0);
	});

	it("未 import DIProvider 应当报错", () => {
		const code = `
const container = {} as unknown as DIContainer;
render(<PlayerView />);
`;
		const errors = checkCode(code, pageTestPath, options);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("DIProvider");
	});

	it("缺少 as unknown as DIContainer 断言应当报错", () => {
		const code = `
import { DIProvider } from "@/di/DIContext";
import { createDIContainerForTest } from "@/test/test-utils";

const container = createDIContainerForTest();
render(<DIProvider value={container}><PlayerView /></DIProvider>);
`;
		const errors = checkCode(code, pageTestPath, options);
		expect(errors.some((e) => e.message.includes("DIContainer"))).toBe(true);
	});

	it("使用 createDIContainerForTest 应当报错", () => {
		const code = `
import { DIProvider } from "@/di/DIContext";
import { createDIContainerForTest } from "@/test/test-utils";

const container = createDIContainerForTest() as unknown as DIContainer;
render(<DIProvider value={container}><PlayerView /></DIProvider>);
`;
		const errors = checkCode(code, pageTestPath, options);
		expect(errors.some((e) => e.message.includes("createDIContainerForTest"))).toBe(
			true,
		);
	});

	it("sibling 不是组合根时跳过页面测试检查", () => {
		const code = `
import { createDIContainerForTest } from "@/test/test-utils";
`;
		const errors = checkCode(code, pageTestPath, {
			siblingUsesUseDI: false,
		});
		expect(errors).toHaveLength(0);
	});
});