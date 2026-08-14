import fs from "node:fs";
import path from "node:path";

export interface CommandErrorLocation {
	line: number;
	column: number;
	severity: "error";
	message: string;
}

export function checkCode(
	code: string,
	filepath: string,
): CommandErrorLocation[] {
	const lines = code.split("\n");
	const errors: CommandErrorLocation[] = [];

	let hasCommandAttr = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		if (line.includes("#[tauri::command]")) {
			hasCommandAttr = true;
			continue;
		}

		if (hasCommandAttr) {
			// Skip empty lines or comments
			if (line === "" || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
				continue;
			}

			// Check for function declaration
			if (line.includes("fn ") || line.endsWith("fn")) {
				const isAsync = line.includes("async fn ");
				if (!isAsync) {
					// Extract function name for a better error message if possible
					const fnNameMatch = line.match(/(?:fn\s+)([a-zA-Z0-9_]+)/);
					const fnName = fnNameMatch ? fnNameMatch[1] : "unknown";

					errors.push({
						line: i + 1,
						column: lines[i].indexOf("fn") + 1,
						severity: "error",
						message: `Tauri Command 必须是异步的 (async fn)。发现同步命令: "${fnName}"。`,
					});
				}
				hasCommandAttr = false;
			} else if (line.startsWith("#")) {
				// If we encounter another attribute without finding a fn, reset (unlikely but safe)
				hasCommandAttr = false;
			}
		}
	}

	return errors;
}

// CLI 逻辑
if (
	process.argv[1] &&
	(process.argv[1].endsWith("check-tauri-commands.ts") ||
		process.argv[1].endsWith("check-tauri-commands.js"))
) {
	main();
}

function main() {
	const defaultFile = path.resolve(process.cwd(), "src-tauri/src/lib.rs");
	const fileToCheck = fs.existsSync(defaultFile) ? defaultFile : null;

	if (!fileToCheck) {
		console.log("未找到 src-tauri/src/lib.rs 文件。");
		process.exit(0);
	}

	const code = fs.readFileSync(fileToCheck, "utf8");
	const relativePath = path.relative(process.cwd(), fileToCheck);
	const violations = checkCode(code, fileToCheck);

	let totalErrors = 0;
	if (violations.length > 0) {
		for (const loc of violations) {
			totalErrors++;
			console.error(
				`❌ 错误: ${relativePath}:${loc.line}:${loc.column} - ${loc.message}`,
			);
		}
	}

	if (totalErrors > 0) {
		console.error(
			`\n🛑 校验未通过：发现了 ${totalErrors} 处同步 Tauri Command。请将所有 #[tauri::command] 函数修改为 async fn，以避免阻塞主线程。`,
		);
		process.exit(1);
	} else {
		console.log("✨ 检查通过：所有的 #[tauri::command] 都是异步函数 (async fn)。");
		process.exit(0);
	}
}
