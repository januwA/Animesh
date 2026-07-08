import { describe, expect, it } from "vitest";
import { checkCode } from "./check-presentation-tauri-imports";

describe("表现层 Tauri 导入规范检查", () => {
	it("当没有导入任何 @tauri-apps 的模块时，应该通过检查", () => {
		const code = `
			import { useState } from "react";
			import { useDI } from "@/di/DIContext";
			
			export default function MyComponent() {
				return null;
			}
		`;
		const results = checkCode(code, "MyComponent.tsx");
		expect(results).toHaveLength(0);
	});

	it("当使用静态 import 导入 @tauri-apps 的包时，应该报错", () => {
		const code = `
			import { useState } from "react";
			import { openUrl } from "@tauri-apps/plugin-opener";
			
			export default function MyComponent() {
				return null;
			}
		`;
		const results = checkCode(code, "MyComponent.tsx");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("禁止导入 Tauri 相关的依赖包");
		expect(results[0].line).toBe(3);
	});

	it("当使用动态 import 导入 @tauri-apps 的包时，应该报错", () => {
		const code = `
			export default function MyComponent() {
				const handleClick = async () => {
					const { openUrl } = await import("@tauri-apps/plugin-opener");
					await openUrl("http://example.com");
				};
				return <button onClick={handleClick}>Click</button>;
			}
		`;
		const results = checkCode(code, "MyComponent.tsx");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("禁止导入 Tauri 相关的依赖包");
		expect(results[0].line).toBe(4);
	});

	it("当使用 export from 导出 @tauri-apps 的包时，应该报错", () => {
		const code = `
			export { openUrl } from "@tauri-apps/plugin-opener";
		`;
		const results = checkCode(code, "MyComponent.tsx");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("禁止导入 Tauri 相关的依赖包");
		expect(results[0].line).toBe(2);
	});
});
