import { describe, expect, it } from "vitest";
import { checkCode } from "./check-application-params";

describe("应用层接口设计参数检查", () => {
	it("当 execute 方法参数不超过两个时，应该通过检查", () => {
		const code = `
      export class MyUseCase {
        execute(ctx: any, dto: any) {
          return null;
        }
      }
    `;
		const results = checkCode(code, "MyUseCase.ts");
		expect(results).toHaveLength(0);
	});

	it("当 execute 方法参数超过两个时，应该报错", () => {
		const code = `
      export class MyUseCase {
        execute(ctx: any, param1: string, param2: number) {
          return null;
        }
      }
    `;
		const results = checkCode(code, "MyUseCase.ts");
		expect(results).toHaveLength(1);
		expect(results[0]).toEqual({
			line: 3,
			column: 9,
			severity: "error",
			message: "应用层接口 execute 方法的参数不能超过 2 个，当前有 3 个参数。",
		});
	});

	it("当类中包含其他方法（如构造函数或其他辅助方法）参数超过两个时，不应该报错", () => {
		const code = `
      export class MyUseCase {
        constructor(private a: any, private b: any, private c: any) {}
        
        private helper(a: any, b: any, c: any) {
          return null;
        }

        execute(ctx: any) {
          return null;
        }
      }
    `;
		const results = checkCode(code, "MyUseCase.ts");
		expect(results).toHaveLength(0);
	});

	it("应当支持类属性定义的 execute 箭头函数方法", () => {
		const code = `
      export class MyUseCase {
        execute = (ctx: any, param1: string, param2: number) => {
          return null;
        }
      }
    `;
		const results = checkCode(code, "MyUseCase.ts");
		expect(results).toHaveLength(1);
		expect(results[0].severity).toBe("error");
		expect(results[0].message).toContain("不能超过 2 个");
	});
});
