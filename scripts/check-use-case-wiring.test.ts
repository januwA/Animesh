import { describe, expect, it } from "vitest";
import {
	checkApplicationDeadCode,
	collectInstantiatedClasses,
	parseApplicationClasses,
} from "./check-use-case-wiring";

describe("应用层类解析", () => {
	it("应当解析出 export class 的类名与位置", () => {
		const code = `
			export class GetCollectionsUseCase {
				async execute(): Promise<void> {}
			}
			export class AddFavoriteUseCase {
				async execute(): Promise<void> {}
			}
		`;
		const classes = parseApplicationClasses(code, "GetCollectionsUseCase.ts");
		expect(classes).toHaveLength(2);
		expect(classes[0]).toMatchObject({
			name: "GetCollectionsUseCase",
			filepath: "GetCollectionsUseCase.ts",
		});
		expect(classes[1].name).toBe("AddFavoriteUseCase");
	});

	it("应当支持解析 export default class", () => {
		const code = `
			export default class MyUseCase {
				async execute(): Promise<void> {}
			}
		`;
		const classes = parseApplicationClasses(code, "MyUseCase.ts");
		expect(classes).toHaveLength(1);
		expect(classes[0].name).toBe("MyUseCase");
	});

	it("应当忽略接口与普通函数（非类）", () => {
		const code = `
			export interface SomeDto { id: number }
			export function helper(): void {}
			export class RealUseCase {
				async execute(): Promise<void> {}
			}
		`;
		const classes = parseApplicationClasses(code, "RealUseCase.ts");
		expect(classes).toHaveLength(1);
		expect(classes[0].name).toBe("RealUseCase");
	});
});

describe("DI 容器实例化类收集", () => {
	it("应当收集 new 表达式中的类名", () => {
		const code = `
			const foo = new GetCollectionsUseCase(repo);
			const bar = new Logger();
		`;
		const instantiated = collectInstantiatedClasses(code, "DIContext.tsx");
		expect([...instantiated].sort()).toEqual([
			"GetCollectionsUseCase",
			"Logger",
		]);
	});

	it("非标识符 callee 的 new 表达式应被忽略", () => {
		const code = `
			const foo = new (getFactory())();
		`;
		const instantiated = collectInstantiatedClasses(code, "DIContext.tsx");
		expect(instantiated.size).toBe(0);
	});
});

describe("应用层死代码检查", () => {
	it("当类未在 DI 容器实例化时，应当报死代码", () => {
		const classes = parseApplicationClasses(
			`
				export class GetCollectionsUseCase {
					async execute(): Promise<void> {}
				}
				export class DeadUseCase {
					async execute(): Promise<void> {}
				}
			`,
			"DeadUseCase.ts",
		);
		const errors = checkApplicationDeadCode(classes, new Set(["GetCollectionsUseCase"]));
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			name: "DeadUseCase",
			severity: "error",
			message: expect.stringContaining("DeadUseCase"),
		});
	});

	it("当类均已接入 DI 容器时，应当通过检查", () => {
		const classes = parseApplicationClasses(
			`
				export class GetCollectionsUseCase {
					async execute(): Promise<void> {}
				}
			`,
			"GetCollectionsUseCase.ts",
		);
		const errors = checkApplicationDeadCode(classes, new Set(["GetCollectionsUseCase"]));
		expect(errors).toHaveLength(0);
	});
});