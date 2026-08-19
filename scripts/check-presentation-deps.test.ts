import { describe, expect, it } from "vitest";
import { checkCode } from "./check-presentation-deps";

const ROOT = process.cwd();

describe("checkCode deps 接口 Pick 声明规范", () => {
	it("属性均使用 Pick<UseCase, \"execute\"> 的接口应当通过", () => {
		const code = `
import type { GetSettingsUseCase } from "@/application/settings/GetSettingsUseCase";
import type { SaveSettingsUseCase } from "@/application/settings/SaveSettingsUseCase";

export interface UseSettingsActionsDeps {
  getSettingsUseCase: Pick<GetSettingsUseCase, "execute">;
  saveSettingsUseCase: Pick<SaveSettingsUseCase, "execute">;
}
`;
		const errors = checkCode(code, `${ROOT}/src/presentation/pages/Settings/useSettingsActions.ts`);
		expect(errors).toHaveLength(0);
	});

	it("多行书写的 Pick 也应当通过", () => {
		const code = `
import type { GetSubtitleTranslationsUseCase } from "@/application/subtitle/GetSubtitleTranslationsUseCase";

export interface UsePlayerDataDeps {
  getSubtitleTranslationsUseCase: Pick<
    GetSubtitleTranslationsUseCase,
    "execute"
  >;
}
`;
		const errors = checkCode(code, `${ROOT}/src/presentation/pages/Player/usePlayerData.ts`);
		expect(errors).toHaveLength(0);
	});

	it("使用 extends 继承的 deps 接口只检查自身属性", () => {
		const code = `
import type { GetSettingsUseCase } from "@/application/settings/GetSettingsUseCase";
import type { UseSettingsActionsDeps } from "./useSettingsActions";

export interface UseSettingsPageDeps extends UseSettingsActionsDeps {
  getSettingsUseCase: Pick<GetSettingsUseCase, "execute">;
}
`;
		const errors = checkCode(code, `${ROOT}/src/presentation/pages/Settings/useSettingsPage.ts`);
		expect(errors).toHaveLength(0);
	});

	it("属性直接使用 UseCase 类型而非 Pick 应当报错", () => {
		const code = `
import type { GetSettingsUseCase } from "@/application/settings/GetSettingsUseCase";

export interface UseSettingsActionsDeps {
  getSettingsUseCase: GetSettingsUseCase;
}
`;
		const errors = checkCode(code, `${ROOT}/src/presentation/pages/Settings/useSettingsActions.ts`);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			severity: "error",
			message: expect.stringContaining("Pick<"),
		});
	});

	it("Pick 的第二个类型参数不是 execute 应当报错", () => {
		const code = `
import type { GetSettingsUseCase } from "@/application/settings/GetSettingsUseCase";

export interface UseSettingsActionsDeps {
  getSettingsUseCase: Pick<GetSettingsUseCase, "run">;
}
`;
		const errors = checkCode(code, `${ROOT}/src/presentation/pages/Settings/useSettingsActions.ts`);
		expect(errors).toHaveLength(1);
	});

	it("非 Deps 结尾的接口应当被忽略", () => {
		const code = `
export interface SomeOtherInterface {
  foo: string;
  bar: number;
}
`;
		const errors = checkCode(code, `${ROOT}/src/presentation/pages/Settings/useSettingsActions.ts`);
		expect(errors).toHaveLength(0);
	});

	it("类型别名形式的 deps 也应检查", () => {
		const code = `
import type { GetSettingsUseCase } from "@/application/settings/GetSettingsUseCase";

export type UseSettingsActionsDeps = {
  getSettingsUseCase: Pick<GetSettingsUseCase, "execute">;
  other: GetSettingsUseCase;
};
`;
		const errors = checkCode(code, `${ROOT}/src/presentation/pages/Settings/useSettingsActions.ts`);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("other");
	});
});