import { describe, expect, it } from "vitest";
import { checkCode } from "./check-dependency-injection";

describe("依赖注入规范检查", () => {
	it("纯构造函数注入的类应该通过检查", () => {
		const code = `
      import type { HttpClient } from "../http/HttpClient";
      export class Repo {
        constructor(private readonly client: HttpClient) {}
      }
    `;
		const results = checkCode(code, "Repo.ts");
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
		const results = checkCode(code, "Repo.ts");
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
		const results = checkCode(code, "Repo.ts");
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
		const results = checkCode(code, "ConsoleLogger.ts");
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
		const results = checkCode(code, "Repo.ts");
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
		const results = checkCode(code, "Repo.ts");
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
		const results = checkCode(code, "Repo.ts");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("Helper");
	});

	it("顶层直接 new 项目内部类应该报错（无包裹类可豁免）", () => {
		const code = `
      import { ConsoleLogger } from "./ConsoleLogger";
      const logger = new ConsoleLogger();
    `;
		const results = checkCode(code, "app.ts");
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
		const results = checkCode(code, "Repo.ts");
		expect(results).toHaveLength(2);
	});
});
