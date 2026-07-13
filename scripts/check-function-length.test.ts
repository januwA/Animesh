import { describe, expect, it } from "vitest";
import { checkCode } from "./check-function-length";

describe("函数/方法长度检查", () => {
	it("当函数和方法不超过 30 行时，应当通过检查", () => {
		const code = `
			function okFunction() {
				console.log("1");
				console.log("2");
			}

			class OkClass {
				okMethod() {
					console.log("1");
					console.log("2");
				}
			}

			const okArrow = () => {
				console.log("1");
				console.log("2");
			};
		`;
		const results = checkCode(code, "ok.ts");
		expect(results).toHaveLength(0);
	});

	it("当普通函数超过 30 行时，应当报错", () => {
		// 31 个 console.log，逻辑行数为 31 行
		const body = Array.from({ length: 31 }, (_, i) => `\tconsole.log(${i});`).join("\n");
		const code = `function longFunction() {\n${body}\n}`;
		const results = checkCode(code, "long-func.ts");
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			line: 1,
			severity: "error",
			message: "函数 longFunction 的函数体逻辑长度为 31 行，超过了 30 行的最大限制（已过滤定义签名、注释及空行）。",
		});
	});

	it("当类方法超过 30 行时，应当报错", () => {
		const body = Array.from({ length: 31 }, (_, i) => `\t\tconsole.log(${i});`).join("\n");
		const code = `class LongClass {\n\tlongMethod() {\n${body}\n\t}\n}`;
		const results = checkCode(code, "long-method.ts");
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			line: 2,
			severity: "error",
			message: "方法 longMethod 的函数体逻辑长度为 31 行，超过了 30 行的最大限制（已过滤定义签名、注释及空行）。",
		});
	});

	it("当箭头函数超过 30 行时，应当报错", () => {
		const body = Array.from({ length: 31 }, (_, i) => `\tconsole.log(${i});`).join("\n");
		const code = `const longArrow = () => {\n${body}\n};`;
		const results = checkCode(code, "long-arrow.ts");
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			line: 1,
			severity: "error",
			message: "函数 longArrow 的函数体逻辑长度为 31 行，超过了 30 行的最大限制（已过滤定义签名、注释及空行）。",
		});
	});

	it("当函数没有函数体或属于类型声明时，应当忽略", () => {
		const code = `
			export declare function declareFunc(): void;

			export interface MyInterface {
				method(): void;
			}

			export type MyType = {
				funcProp: () => void;
			};
		`;
		const results = checkCode(code, "declare.ts");
		expect(results).toHaveLength(0);
	});

	it("计算行数时应当忽略空行和注释", () => {
		const code = `
			function mixFunction() {
				// 这是一个单行注释
				console.log("1");

				/*
				  这是一个多行注释
				  包含多行内容
				*/
				console.log("2");
			}
		`;
		// 共有 11 行文本，但只有：
		// 1. function mixFunction() {
		// 2. console.log("1");
		// 3. console.log("2");
		// 4. }
		// 共 4 行逻辑代码
		const results = checkCode(code, "mix.ts");
		expect(results).toHaveLength(0);
	});
});
