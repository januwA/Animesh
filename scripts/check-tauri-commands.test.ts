import { describe, expect, it } from "vitest";
import { checkCode } from "./check-tauri-commands";

describe("Tauri Command 异步规范检查", () => {
	it("当所有的 #[tauri::command] 函数都是 async fn 时，应该通过检查", () => {
		const code = `
			#[tauri::command]
			async fn test_cmd1() {}

			#[tauri::command]
			pub async fn test_cmd2() {}
		`;
		const results = checkCode(code, "lib.rs");
		expect(results).toHaveLength(0);
	});

	it("当 #[tauri::command] 之后有注释时，应该能正常检查并识别 async fn", () => {
		const code = `
			#[tauri::command]
			// 这是一个测试注释
			async fn test_cmd1() {}
		`;
		const results = checkCode(code, "lib.rs");
		expect(results).toHaveLength(0);
	});

	it("当存在同步的 #[tauri::command] 函数时，应该报错且指出正确的行号", () => {
		const code = `
			#[tauri::command]
			fn sync_command() {}

			#[tauri::command]
			pub fn sync_pub_command() {}
		`;
		const results = checkCode(code, "lib.rs");
		expect(results).toHaveLength(2);
		expect(results[0].message).toContain("Tauri Command 必须是异步的");
		expect(results[0].message).toContain("sync_command");
		expect(results[0].line).toBe(3);

		expect(results[1].message).toContain("sync_pub_command");
		expect(results[1].line).toBe(6);
	});
});
