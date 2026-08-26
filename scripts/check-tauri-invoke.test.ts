import { describe, expect, it } from "vitest";
import { checkDeadCommands, checkInvokeMagicString } from "./check-tauri-invoke";

function makeCommands(...names: string[]): Map<string, string> {
	return new Map(names.map((n) => [n, n]));
}

describe("invoke 魔法字符串检测", () => {
	it("当 invoke 使用字符串字面量作为命令名时，应该报错", () => {
		const code = `
			import { invoke } from "@tauri-apps/api/core";
			await invoke<string>("ai_chat_request", { endpoint });
		`;
		const results = checkInvokeMagicString(code, "test.ts");
		expect(results).toHaveLength(1);
		expect(results[0].severity).toBe("error");
		expect(results[0].message).toContain("魔法字符串");
		expect(results[0].message).toContain("commands.ai_chat_request");
	});

	it("当 invoke 使用 commands 常量时，应该通过检查", () => {
		const code = `
			import { invoke } from "@tauri-apps/api/core";
			import { commands } from "@/generated/tauri-commands";
			await invoke<string>(commands.ai_chat_request, { endpoint });
		`;
		const results = checkInvokeMagicString(code, "test.ts");
		expect(results).toHaveLength(0);
	});

	it("当存在多个 invoke 调用且都使用魔法字符串时，应该报多个错", () => {
		const code = `
			import { invoke } from "@tauri-apps/api/core";
			await invoke<void>("cancel_search", { traceId });
			await invoke<void>("torrent_pause", { infoHash });
		`;
		const results = checkInvokeMagicString(code, "test.ts");
		expect(results).toHaveLength(2);
	});

	it("当 invoke 混合使用魔法字符串和 commands 常量时，仅对魔法字符串报错", () => {
		const code = `
			import { invoke } from "@tauri-apps/api/core";
			await invoke<void>("cancel_search", { traceId });
			await invoke<void>(commands.torrent_pause, { infoHash });
		`;
		const results = checkInvokeMagicString(code, "test.ts");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("cancel_search");
	});

	it("当没有 invoke 调用时，应该通过检查", () => {
		const code = `
			import { useState } from "react";
			const [count, setCount] = useState(0);
		`;
		const results = checkInvokeMagicString(code, "test.ts");
		expect(results).toHaveLength(0);
	});

	it("当 invoke 使用变量作为命令名时，应该通过检查", () => {
		const code = `
			import { invoke } from "@tauri-apps/api/core";
			const cmd = getCommandName();
			await invoke<void>(cmd, { traceId });
		`;
		const results = checkInvokeMagicString(code, "test.ts");
		expect(results).toHaveLength(0);
	});
});

describe("死命令检测", () => {
	it("当所有命令都被引用时，应该通过检查", () => {
		const commands = makeCommands("cancel_search", "torrent_pause");
		const fileContents = new Map([
			["src/infra.ts", 'invoke("cancel_search")'],
			["src/settings.ts", 'invoke("torrent_pause")'],
		]);
		const results = checkDeadCommands(commands, fileContents);
		expect(results).toHaveLength(0);
	});

	it("当存在未被引用的命令时，应该报错", () => {
		const commands = makeCommands("cancel_search", "iptv_proxy_base_url");
		const fileContents = new Map([
			["src/infra.ts", 'invoke("cancel_search")'],
		]);
		const results = checkDeadCommands(commands, fileContents);
		expect(results).toHaveLength(1);
		expect(results[0].severity).toBe("error");
		expect(results[0].message).toContain("iptv_proxy_base_url");
		expect(results[0].message).toContain("死命令");
	});

	it("当命令通过 commands 对象引用时，应该识别为已使用", () => {
		const commands = makeCommands("cancel_search", "iptv_proxy_base_url");
		const fileContents = new Map([
			["src/infra.ts", "invoke(commands.cancel_search, { traceId })"],
		]);
		const results = checkDeadCommands(commands, fileContents);
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("iptv_proxy_base_url");
	});

	it("当没有命令时，应该通过检查", () => {
		const commands = new Map<string, string>();
		const fileContents = new Map([["src/infra.ts", "const x = 1"]]);
		const results = checkDeadCommands(commands, fileContents);
		expect(results).toHaveLength(0);
	});

	it("当所有命令都是死命令时，应该报所有命令", () => {
		const commands = makeCommands(
			"cancel_search",
			"torrent_pause",
			"torrent_resume",
		);
		const fileContents = new Map([["src/empty.ts", ""]]);
		const results = checkDeadCommands(commands, fileContents);
		expect(results).toHaveLength(3);
	});
});
