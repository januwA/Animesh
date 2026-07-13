import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");
const PKG_PATH = path.join(ROOT_DIR, "package.json");
const CARGO_PATHS = [
	path.join(ROOT_DIR, "src-tauri/Cargo.toml"),
];

export function parseSemver(version: string): { major: number; minor: number; patch: number; pre?: string } {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?$/);
	if (!match) {
		throw new Error(`无效的版本号格式: "${version}"。请使用标准的 SemVer 格式 (如: 1.0.0 或 1.2.3-alpha.1)。`);
	}
	return {
		major: parseInt(match[1], 10),
		minor: parseInt(match[2], 10),
		patch: parseInt(match[3], 10),
		pre: match[4],
	};
}

export function compareSemver(v1: string, v2: string): number {
	const s1 = parseSemver(v1);
	const s2 = parseSemver(v2);

	if (s1.major !== s2.major) return s1.major - s2.major;
	if (s1.minor !== s2.minor) return s1.minor - s2.minor;
	if (s1.patch !== s2.patch) return s1.patch - s2.patch;

	if (s1.pre && !s2.pre) return -1;
	if (!s1.pre && s2.pre) return 1;
	if (s1.pre && s2.pre) {
		return s1.pre.localeCompare(s2.pre, undefined, { numeric: true, sensitivity: "base" });
	}

	return 0;
}

export function updateCargoToml(filePath: string, newVersion: string) {
	const content = fs.readFileSync(filePath, "utf-8");
	const regex = /(\[(?:workspace\.)?package\][\s\S]*?version\s*=\s*")[^"]+(")/;
	if (!regex.test(content)) {
		throw new Error(`在 ${filePath} 中找不到 package.version 字段`);
	}
	const updatedContent = content.replace(regex, `$1${newVersion}$2`);
	fs.writeFileSync(filePath, updatedContent, "utf-8");
}

function main() {
	const targetVersion = process.argv[2];
	if (!targetVersion) {
		console.error("错误: 请提供目标版本号。例如: pnpm bump-version 0.3.0");
		process.exit(1);
	}

	try {
		// 验证目标版本号格式
		parseSemver(targetVersion);

		// 读取 package.json 当前版本
		if (!fs.existsSync(PKG_PATH)) {
			throw new Error("根目录下找不到 package.json 文件");
		}
		const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf-8"));
		const currentVersion = pkg.version;

		console.log(`当前版本号: ${currentVersion}`);
		console.log(`目标版本号: ${targetVersion}`);

		// 检查版本号是否变低或相同
		const comparison = compareSemver(targetVersion, currentVersion);
		if (comparison < 0) {
			throw new Error(`目标版本号 (${targetVersion}) 不能低于当前版本号 (${currentVersion})`);
		}
		if (comparison === 0) {
			throw new Error(`目标版本号 (${targetVersion}) 与当前版本号相同`);
		}

		// 1. 更新 package.json
		pkg.version = targetVersion;
		fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
		console.log(`[✔] 成功更新 package.json 版本号为 ${targetVersion}`);

		// 2. 更新各个 Cargo.toml
		for (const cargoPath of CARGO_PATHS) {
			if (fs.existsSync(cargoPath)) {
				updateCargoToml(cargoPath, targetVersion);
				const relPath = path.relative(ROOT_DIR, cargoPath);
				console.log(`[✔] 成功更新 ${relPath} 中的 package.version 为 ${targetVersion}`);
			}
		}

		// 3. 更新 src-tauri/Cargo.lock
		const tauriCargoToml = path.join(ROOT_DIR, "src-tauri/Cargo.toml");
		if (fs.existsSync(tauriCargoToml)) {
			console.log("正在更新 src-tauri/Cargo.lock...");
			execSync(`cargo update --workspace --manifest-path "${tauriCargoToml}"`, {
				stdio: "inherit",
			});
			console.log("[✔] 成功更新 src-tauri/Cargo.lock");
		}

		console.log(`\n🎉 版本号已成功升级至 ${targetVersion}!`);
	} catch (err: any) {
		console.error(`\n❌ 更新版本号失败: ${err.message}`);
		process.exit(1);
	}
}

if (
	process.argv[1] &&
	(process.argv[1].endsWith("bump-version.ts") ||
		process.argv[1].endsWith("bump-version.js"))
) {
	main();
}
