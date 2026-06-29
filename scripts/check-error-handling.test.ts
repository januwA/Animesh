import { describe, expect, it } from "vitest";
import { checkCode } from "./check-error-handling";

describe("错误处理与 console 规范检查", () => {
	describe("console 禁用检查", () => {
		it("应当能识别出直接调用 console.error 并标记为 error", () => {
			const code = `
        function test() {
          console.error("这是一个错误");
        }
      `;
			const results = checkCode(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({
				line: 3,
				column: 11, // 拦截 console 标识符本身，它在这一行的第 11 列（缩进 8 空格 + "c" 是第 9 个字符？等一下，前面有 8 个空格缩进，那么 "c" 在第 9 列。我们之前的测试写的是 9，但因为我们是拦截 console，如果从 c 开始，确实是第 9 列，等一下，刚才测试中 console.error 拦截的 property.start，所以是 9 吗？我们待会儿可以根据 Identifier 'console' 的位置来测）
				severity: "error",
				message: "禁用了 console 对象的所有成员访问和调用。",
			});
		});

		it("应当能拦截 console.log 调用", () => {
			const code = `
        console.log("info");
      `;
			const results = checkCode(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0].severity).toBe("error");
		});

		it("应当能拦截 console.warn 调用", () => {
			const code = `
        console.warn("warning");
      `;
			const results = checkCode(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0].severity).toBe("error");
		});

		it("应当能拦截对 console 对象的直接引用", () => {
			const code = `
        const myConsole = console;
      `;
			const results = checkCode(code, "test.ts");
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
			const results = checkCode(code, "test.ts");
			// 直接 throw 捕获的对象是允许的，但因为这个 catch 块里有 throw，所以不应该有吞错误的 warning。
			// 所以整体应该没有任何报错/警告
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
			const results = checkCode(code, "test.ts");
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
			const results = checkCode(code, "test.ts");
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
			const results = checkCode(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0].severity).toBe("error");
		});

		it("普通函数中直接 throw 新错误不需要 cause 应被允许", () => {
			const code = `
        function foo() {
          throw new Error("普通抛错");
        }
      `;
			const results = checkCode(code, "test.ts");
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
			const results = checkCode(code, "test.ts");
			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({
				line: 4,
				column: 11, // catch 关键字开始的位置，即缩进 8 空格 + 1 = 9。等一下，第 4 行 `        } catch (err) {` 中，"c" 应该在第 11 列（缩进 8 空格 + "}" 1 字符 + " " 1 字符 = 10，所以 "c" 是第 11 个字符）。我们可以在测试里使用 assert 检测 line 4，且 severity 为 warning
				severity: "warning",
				message:
					"发现疑似吞掉错误的 catch 块（未向上抛出错误或重新包装抛出）。建议处理并继续向上抛出，以符合错误处理规范。",
			});
		});
	});
});
