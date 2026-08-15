import { describe, expect, it } from "vitest";
import {
	checkDeadCode,
	checkDIContainer,
	collectUsedDIKeys,
	parseDIContainer,
} from "./check-di-container";

describe("DI 容器接口解析", () => {
	it("应当解析出 DIContainer 的 key、类型名与位置", () => {
		const code = `
			import type { CollectionRepository } from "../domain/collection/CollectionRepository";
			import type { GetCollectionsUseCase } from "../application/collection/GetCollectionsUseCase";

			export interface DIContainer {
				collectionRepository: CollectionRepository;
				getCollectionsUseCase: GetCollectionsUseCase;
			}
		`;
		const keys = parseDIContainer(code, "DIContext.tsx");
		expect(keys).toHaveLength(2);
		expect(keys[0]).toMatchObject({
			name: "collectionRepository",
			typeName: "CollectionRepository",
		});
		expect(keys[1]).toMatchObject({
			name: "getCollectionsUseCase",
			typeName: "GetCollectionsUseCase",
		});
	});

	it("当非 DIContainer 接口存在时，应当被忽略", () => {
		const code = `
			export interface OtherInterface {
				foo: string;
			}
			export interface DIContainer {
				logger: Logger;
			}
		`;
		const keys = parseDIContainer(code, "DIContext.tsx");
		expect(keys).toHaveLength(1);
		expect(keys[0].name).toBe("logger");
	});

	it("当类型不是 TSTypeReference 时，typeName 应为 null", () => {
		const code = `
			export interface DIContainer {
				complex: string | null;
			}
		`;
		const keys = parseDIContainer(code, "DIContext.tsx");
		expect(keys[0]).toMatchObject({ name: "complex", typeName: null });
	});
});

describe("DI 容器使用 key 收集", () => {
	it("应当识别对象解构中的 key", () => {
		const code = `
			import { useDI } from "@/di/DIContext";
			export default function Page() {
				const { getCollectionsUseCase, addFavoriteUseCase } = useDI();
				return null;
			}
		`;
		const used = collectUsedDIKeys(code, "Page.tsx");
		expect([...used].sort()).toEqual([
			"addFavoriteUseCase",
			"getCollectionsUseCase",
		]);
	});

	it("应当识别解构重命名时的原始 key", () => {
		const code = `
			import { useDI } from "@/di/DIContext";
			export default function Page() {
				const { logger: appLogger } = useDI();
				return null;
			}
		`;
		const used = collectUsedDIKeys(code, "Page.tsx");
		expect([...used]).toEqual(["logger"]);
	});

	it("应当识别 useDI() 链式成员访问", () => {
		const code = `
			import { useDI } from "@/di/DIContext";
			export default function Page() {
				const result = useDI().openUrlUseCase.execute();
				return result;
			}
		`;
		const used = collectUsedDIKeys(code, "Page.tsx");
		expect([...used]).toEqual(["openUrlUseCase"]);
	});

	it("应当识别别名变量的成员访问与解构", () => {
		const code = `
			import { useDI } from "@/di/DIContext";
			export default function Page() {
				const di = useDI();
				const value = di.getSettingsUseCase.execute();
				const { clearCacheUseCase } = di;
				return value;
			}
		`;
		const used = collectUsedDIKeys(code, "Page.tsx");
		expect([...used].sort()).toEqual(["clearCacheUseCase", "getSettingsUseCase"]);
	});

	it("当文件未导入 useDI 时，应当返回空集合", () => {
		const code = `
			export default function Page() {
				const { getCollectionsUseCase } = useDI();
				return null;
			}
		`;
		const used = collectUsedDIKeys(code, "Page.tsx");
		expect(used.size).toBe(0);
	});

	it("计算成员访问应被忽略（无法静态解析）", () => {
		const code = `
			import { useDI } from "@/di/DIContext";
			export default function Page(key: string) {
				const di = useDI();
				return di[key];
			}
		`;
		const used = collectUsedDIKeys(code, "Page.tsx");
		expect(used.size).toBe(0);
	});
});

describe("DI 容器 Repository 检查", () => {
	it("当 key 类型名以 Repository 结尾时，应当报错", () => {
		const keys = parseDIContainer(
			`
				export interface DIContainer {
					collectionRepository: CollectionRepository;
					logger: Logger;
				}
			`,
			"DIContext.tsx",
		);
		const errors = checkDIContainer(keys);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			severity: "error",
			message: expect.stringContaining("collectionRepository"),
		});
	});

	it("当容器中不含 Repository 时，应当通过检查", () => {
		const keys = parseDIContainer(
			`
				export interface DIContainer {
					logger: Logger;
					aiClient: AiClient;
				}
			`,
			"DIContext.tsx",
		);
		const errors = checkDIContainer(keys);
		expect(errors).toHaveLength(0);
	});
});

describe("DI 容器死代码检查", () => {
	it("当 key 未被表现层使用时，应当报死代码", () => {
		const keys = parseDIContainer(
			`
				export interface DIContainer {
					logger: Logger;
					getTorrentFilesUseCase: GetTorrentFilesUseCase;
				}
			`,
			"DIContext.tsx",
		);
		const errors = checkDeadCode(keys, new Set(["logger"]));
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			severity: "error",
			message: expect.stringContaining("getTorrentFilesUseCase"),
		});
	});

	it("当 key 均被表现层使用时，应当通过检查", () => {
		const keys = parseDIContainer(
			`
				export interface DIContainer {
					logger: Logger;
					getSettingsUseCase: GetSettingsUseCase;
				}
			`,
			"DIContext.tsx",
		);
		const errors = checkDeadCode(
			keys,
			new Set(["logger", "getSettingsUseCase"]),
		);
		expect(errors).toHaveLength(0);
	});
});
