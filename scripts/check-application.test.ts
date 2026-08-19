import { describe, expect, it } from "vitest";
import {
	checkApplicationParams,
	checkDependencyInjection,
	checkErrorHandling,
} from "./check-application";

describe("错误处理与 console 规范检查", () => {
	describe("console 禁用检查", () => {
		it("应当能识别出直接调用 console.error 并标记为 error", () => {
			const code = `
        function test() {
          console.error("这是一个错误");
        }
      `;
			const results = checkErrorHandling(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({
				line: 3,
				column: 11,
				severity: "error",
				message: "禁用了 console 对象的所有成员访问和调用。",
			});
		});

		it("应当能拦截 console.log 调用", () => {
			const code = `
        console.log("info");
      `;
			const results = checkErrorHandling(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0].severity).toBe("error");
		});

		it("应当能拦截 console.warn 调用", () => {
			const code = `
        console.warn("warning");
      `;
			const results = checkErrorHandling(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0].severity).toBe("error");
		});

		it("应当能拦截对 console 对象的直接引用", () => {
			const code = `
        const myConsole = console;
      `;
			const results = checkErrorHandling(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0].severity).toBe("error");
		});
	});

	describe("catch 块错误重新包装检查", () => {
		it("在 catch 块中直接 throw 原错误应被允许", () => {
			const code = `
        try {
          doSomething();
        } catch (err) {
          throw err;
        }
      `;
			const results = checkErrorHandling(code, "test.ts");
			expect(results).toHaveLength(0);
		});

		it("在 catch 块中重新包装错误且指定了正确的 cause 应被允许", () => {
			const code = `
        try {
          doSomething();
        } catch (error) {
          throw new Error("包装错误", { cause: error });
        }
      `;
			const results = checkErrorHandling(code, "test.ts");
			expect(results).toHaveLength(0);
		});

		it("在 catch 块中重新包装错误但没有提供 cause 应该报错", () => {
			const code = `
        try {
          doSomething();
        } catch (err) {
          throw new Error("没有保留原始错误链");
        }
      `;
			const results = checkErrorHandling(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({
				line: 5,
				column: 11,
				severity: "error",
				message:
					"重新包装抛出新错误时，必须使用 { cause: err } 选项保留原始错误链。",
			});
		});

		it("在 catch 块中重新包装错误但 cause 变量名不匹配 catch 参数应该报错", () => {
			const code = `
        try {
          doSomething();
        } catch (err) {
          throw new Error("错误的cause变量", { cause: otherErr });
        }
      `;
			const results = checkErrorHandling(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0].severity).toBe("error");
		});

		it("普通函数中直接 throw 新错误不需要 cause 应被允许", () => {
			const code = `
        function foo() {
          throw new Error("普通抛错");
        }
      `;
			const results = checkErrorHandling(code, "test.ts");
			expect(results).toHaveLength(0);
		});
	});

	describe("catch 块吞掉错误检查 (Warning)", () => {
		it("在 catch 块中完全没有 throw 任何错误应当报 warning", () => {
			const code = `
        try {
          doSomething();
        } catch (err) {
          // 吞掉了错误，没有 throw
        }
      `;
			const results = checkErrorHandling(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({
				line: 4,
				column: 11,
				severity: "warning",
				message:
					"发现疑似吞掉错误的 catch 块（未向上抛出错误或重新包装抛出）。建议处理并继续向上抛出，以符合错误处理规范。",
			});
		});
	});
});

describe("应用层接口设计参数检查", () => {
	it("当 execute 方法参数不超过两个时，应该通过检查", () => {
		const code = `
      export class MyUseCase {
        execute(ctx: any, dto: any) {
          return null;
        }
      }
    `;
		const results = checkApplicationParams(code, "MyUseCase.ts");
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
		const results = checkApplicationParams(code, "MyUseCase.ts");
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
		const results = checkApplicationParams(code, "MyUseCase.ts");
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
		const results = checkApplicationParams(code, "MyUseCase.ts");
		expect(results).toHaveLength(1);
		expect(results[0].severity).toBe("error");
		expect(results[0].message).toContain("不能超过 2 个");
	});
});

describe("依赖注入规范检查", () => {
	it("纯构造函数注入的类应该通过检查", () => {
		const code = `
      import type { HttpClient } from "../http/HttpClient";
      export class Repo {
        constructor(private readonly client: HttpClient) {}
      }
    `;
		const results = checkDependencyInjection(code, "Repo.ts");
		expect(results).toHaveLength(0);
	});

	it("实例化内建类型与平台 API 应该通过检查", () => {
		const code = `
      export class Repo {
        private set = new Set();
        private map = new Map();
        method() {
          const d = new Date();
          throw new Error("boom");
        }
      }
    `;
		const results = checkDependencyInjection(code, "Repo.ts");
		expect(results).toHaveLength(0);
	});

	it("实例化第三方库类（node_modules）应该通过检查", () => {
		const code = `
      import { Channel } from "@tauri-apps/api/core";
      import { Duration } from "ajanuw-duration";
      export class Repo {
        private ch = new Channel<unknown>();
        private ttl = new Duration({ days: 1 }).inMilliseconds;
      }
    `;
		const results = checkDependencyInjection(code, "Repo.ts");
		expect(results).toHaveLength(0);
	});

	it("类实例化自身（自豁免）应该通过检查", () => {
		const code = `
      export class ConsoleLogger {
        withCategory() {
          return new ConsoleLogger();
        }
      }
    `;
		const results = checkDependencyInjection(code, "ConsoleLogger.ts");
		expect(results).toHaveLength(0);
	});

	it("导入项目内部类后直接 new 应该报错", () => {
		const code = `
      import { FetchHttpClient } from "../http/HttpClient";
      export class Repo {
        constructor() {
          this.client = new FetchHttpClient();
        }
      }
    `;
		const results = checkDependencyInjection(code, "Repo.ts");
		expect(results).toHaveLength(1);
		expect(results[0]).toEqual({
			line: 5,
			column: 25,
			severity: "error",
			message: expect.stringContaining("FetchHttpClient") as unknown as string,
		});
	});

	it("别名导入的项目内部类被 new 时应该报错", () => {
		const code = `
      import { HttpClient as Client } from "../http/HttpClient";
      export class Repo {
        private client = new Client();
      }
    `;
		const results = checkDependencyInjection(code, "Repo.ts");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("Client");
	});

	it("同文件其他类被 new 时应该报错", () => {
		const code = `
      class Helper {}
      export class Repo {
        private helper = new Helper();
      }
    `;
		const results = checkDependencyInjection(code, "Repo.ts");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("Helper");
	});

	it("顶层直接 new 项目内部类应该报错（无包裹类可豁免）", () => {
		const code = `
      import { ConsoleLogger } from "./ConsoleLogger";
      const logger = new ConsoleLogger();
    `;
		const results = checkDependencyInjection(code, "app.ts");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("ConsoleLogger");
	});

	it("同文件多个违规应该全部报告", () => {
		const code = `
      class Helper {}
      export class Repo {
        private a = new Helper();
        private b = new Helper();
      }
    `;
		const results = checkDependencyInjection(code, "Repo.ts");
		expect(results).toHaveLength(2);
	});
});