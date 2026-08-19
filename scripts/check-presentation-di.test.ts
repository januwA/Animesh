import { describe, expect, it } from "vitest";
import { checkCode, isCompositionRoot } from "./check-presentation-di";

const codeWithUseDI = `
import { useDI } from "@/di/DIContext";
export function Component() {
  const { getSettingsUseCase } = useDI();
  return null;
}
`;

describe("isCompositionRoot 组合根判定", () => {
	it("页面入口 index.tsx 属于组合根", () => {
		expect(
			isCompositionRoot(
				`${process.cwd()}/src/presentation/pages/Player/index.tsx`,
			),
		).toBe(true);
	});

	it("单文件页面 pages/*.tsx 属于组合根", () => {
		expect(
			isCompositionRoot(
				`${process.cwd()}/src/presentation/pages/TorrentSearch.tsx`,
			),
		).toBe(true);
	});

	it("页面子目录内的 hook/组件不属于组合根", () => {
		expect(
			isCompositionRoot(
				`${process.cwd()}/src/presentation/pages/Player/usePlayerData.ts`,
			),
		).toBe(false);
		expect(
			isCompositionRoot(
				`${process.cwd()}/src/presentation/pages/Settings/UpdateCheckSection.tsx`,
			),
		).toBe(false);
	});

	it("上下文 Provider 与 routes.tsx 属于组合根", () => {
		expect(
			isCompositionRoot(
				`${process.cwd()}/src/presentation/context/TorrentStatusContext.tsx`,
			),
		).toBe(true);
		expect(isCompositionRoot(`${process.cwd()}/src/presentation/routes.tsx`)).toBe(
			true,
		);
	});

	it("hooks/components 目录不属于组合根", () => {
		expect(
			isCompositionRoot(
				`${process.cwd()}/src/presentation/hooks/useGlobalEffects.ts`,
			),
		).toBe(false);
		expect(
			isCompositionRoot(
				`${process.cwd()}/src/presentation/components/FavoriteButton.tsx`,
			),
		).toBe(false);
	});
});

describe("checkCode useDI 调用规范", () => {
	it("hook 文件调用 useDI 应当报错", () => {
		const errors = checkCode(
			codeWithUseDI,
			`${process.cwd()}/src/presentation/hooks/useSomething.ts`,
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			severity: "error",
			message: expect.stringContaining("useDI()"),
		});
	});

	it("组件文件调用 useDI 应当报错", () => {
		const errors = checkCode(
			codeWithUseDI,
			`${process.cwd()}/src/presentation/components/SomeButton.tsx`,
		);
		expect(errors).toHaveLength(1);
	});

	it("组合根内显式解构 useDI 应当通过", () => {
		const code = `
import { useDI } from "@/di/DIContext";
export default function Page() {
  const { getSettingsUseCase, saveSettingsUseCase } = useDI();
  return null;
}
`;
		const errors = checkCode(
			code,
			`${process.cwd()}/src/presentation/pages/Home/index.tsx`,
		);
		expect(errors).toHaveLength(0);
	});

	it("组合根内 useXxxPage(useDI()) 直接传参应当报错", () => {
		const code = `
import { useDI } from "@/di/DIContext";
import { useSettingsPage } from "./useSettingsPage";
export default function Page() {
  useSettingsPage(useDI());
  return null;
}
`;
		const errors = checkCode(
			code,
			`${process.cwd()}/src/presentation/pages/Home/index.tsx`,
		);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("显式解构");
	});

	it("组合根内 const di = useDI() 别名应当报错", () => {
		const code = `
import { useDI } from "@/di/DIContext";
export default function Page() {
  const di = useDI();
  return di.getSettingsUseCase.execute();
}
`;
		const errors = checkCode(
			code,
			`${process.cwd()}/src/presentation/pages/Home/index.tsx`,
		);
		expect(errors).toHaveLength(1);
	});

	it("未导入 useDI 的文件应当通过", () => {
		const code = `
export function Component() {
  return null;
}
`;
		const errors = checkCode(
			code,
			`${process.cwd()}/src/presentation/components/SomeButton.tsx`,
		);
		expect(errors).toHaveLength(0);
	});
});