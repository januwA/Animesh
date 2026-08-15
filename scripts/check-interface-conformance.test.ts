import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	type FileSystem,
	checkInterfaceConformance,
	parseImplementationClassPublicMethods,
	parseInterfaceMethods,
	resolveBindingTarget,
	resolveInterfaceMethodSet,
} from "./check-interface-conformance";

const ROOT = process.cwd();
const abs = (...parts: string[]) => path.resolve(ROOT, ...parts);

function makeFs(files: Record<string, string>): FileSystem {
	const store = new Map(
		Object.entries(files).map(([key, value]) => [abs(key), value]),
	);
	return {
		exists: (p) => store.has(path.resolve(p)),
		readFile: (p) => store.get(path.resolve(p)) ?? null,
	};
}

describe("接口方法解析", () => {
	it("应当收集接口中的方法与函数类型属性", () => {
		const info = parseInterfaceMethods(
			`
				export interface TorrentRepository {
					search(keyword: string): Promise<void>;
					onChange: (cb: () => void) => void;
					readonly maxResults: number;
				}
			`,
			"TorrentRepository",
		);
		expect(info).not.toBeNull();
		expect([...(info?.methodNames ?? [])].sort()).toEqual([
			"onChange",
			"search",
		]);
	});

	it("应当解析 type 对象类型的函数成员", () => {
		const info = parseInterfaceMethods(
			`
				export type Settings = {
					getTheme(): string;
					update: (patch: unknown) => void;
					locale: string;
				};
			`,
			"Settings",
		);
		expect(info).not.toBeNull();
		expect([...(info?.methodNames ?? [])].sort()).toEqual([
			"getTheme",
			"update",
		]);
	});

	it("找不到目标接口时应当返回 null", () => {
		const info = parseInterfaceMethods(`export interface Foo { bar(): void }`, "Missing");
		expect(info).toBeNull();
	});

	it("应当记录接口的 extends 名称", () => {
		const info = parseInterfaceMethods(
			`interface Child extends Parent, Grand { m(): void }`,
			"Child",
		);
		expect(info?.extendsNames).toEqual(["Parent", "Grand"]);
	});
});

describe("import 绑定解析", () => {
	it("应当解析具名导入的源与导出名", () => {
		const binding = resolveBindingTarget(
			`import type { BangumiRepository } from "@/domain/bangumi/BangumiRepository";`,
			"HttpBangumiRepository.ts",
			"BangumiRepository",
		);
		expect(binding).toEqual({
			source: "@/domain/bangumi/BangumiRepository",
			exportedName: "BangumiRepository",
		});
	});

	it("应当解析带别名的导入", () => {
		const binding = resolveBindingTarget(
			`import { Repo as Alias } from "./repo";`,
			"Foo.ts",
			"Alias",
		);
		expect(binding).toEqual({ source: "./repo", exportedName: "Repo" });
	});

	it("未导入的本地名应当返回 null", () => {
		const binding = resolveBindingTarget(
			`import { Foo } from "./foo";`,
			"Bar.ts",
			"Missing",
		);
		expect(binding).toBeNull();
	});
});

describe("接口方法集解析", () => {
	it("应当解析同文件声明的接口", () => {
		const fs = makeFs({});
		const methods = resolveInterfaceMethodSet(
			`interface Local { a(): void; b(): void }`,
			abs("src", "local.ts"),
			"Local",
			fs,
		);
		expect([...methods ?? []].sort()).toEqual(["a", "b"]);
	});

	it("应当通过相对路径 import 解析接口", () => {
		const fs = makeFs({
			"src/domain/repo.ts": `export interface Repo { find(): void }`,
		});
		const methods = resolveInterfaceMethodSet(
			`import type { Repo } from "../../domain/repo";`,
			abs("src", "infrastructure", "bangumi", "Impl.ts"),
			"Repo",
			fs,
		);
		expect([...methods ?? []].sort()).toEqual(["find"]);
	});

	it("应当通过 @/ 别名 import 解析接口", () => {
		const fs = makeFs({
			"src/domain/logger/logger.ts": `export interface Logger { info(m: string): void }`,
		});
		const methods = resolveInterfaceMethodSet(
			`import type { Logger } from "@/domain/logger/logger";`,
			abs("src", "infrastructure", "ConsoleLogger.ts"),
			"Logger",
			fs,
		);
		expect([...methods ?? []].sort()).toEqual(["info"]);
	});

	it("应当合并 extends 继承的接口方法", () => {
		const fs = makeFs({
			"src/base.ts": `export interface Base { base(): void }`,
		});
		const methods = resolveInterfaceMethodSet(
			`import type { Base } from "./base";\ninterface Child extends Base { own(): void }`,
			abs("src", "child.ts"),
			"Child",
			fs,
		);
		expect([...methods ?? []].sort()).toEqual(["base", "own"]);
	});

	it("无法解析的接口应当返回 null（跳过不误报）", () => {
		const fs = makeFs({});
		const methods = resolveInterfaceMethodSet(
			`import type { External } from "some-pkg";`,
			abs("src", "Impl.ts"),
			"External",
			fs,
		);
		expect(methods).toBeNull();
	});
});

describe("实现类 public 方法解析", () => {
	it("应当收集 public 方法并排除 private/protected/static/constructor", () => {
		const classes = parseImplementationClassPublicMethods(
			`
				export class Impl implements Repo {
					public a(): void {}
					b(): void {}
					private hidden(): void {}
					protected guarded(): void {}
					static staticMethod(): void {}
					constructor() {}
					get g(): string { return ""; }
					set g(v: string) {}
					field = () => {};
					data = 1;
				}
			`,
			"Impl.ts",
		);
		expect(classes).toHaveLength(1);
		expect(classes[0].interfaces).toEqual(["Repo"]);
		expect(
			classes[0].methods.map((m) => m.name).sort(),
		).toEqual(["a", "b", "field", "g"]);
	});

	it("未实现任何接口的类应当被忽略", () => {
		const classes = parseImplementationClassPublicMethods(
			`export class Plain { run(): void {} }`,
			"Plain.ts",
		);
		expect(classes).toHaveLength(0);
	});
});

describe("接口契约检查", () => {
	it("完全匹配的接口实现应当通过", () => {
		const fs = makeFs({
			"src/domain/repo.ts": `export interface Repo { find(): void; save(): void }`,
		});
		const errors = checkInterfaceConformance(
			`import type { Repo } from "@/domain/repo";\nexport class Impl implements Repo { find(): void {} save(): void {} }`,
			abs("src", "infrastructure", "Impl.ts"),
			fs,
		);
		expect(errors).toHaveLength(0);
	});

	it("public 方法不在接口中应当报错（接口删除后遗留）", () => {
		const fs = makeFs({
			"src/domain/repo.ts": `export interface Repo { find(): void }`,
		});
		const errors = checkInterfaceConformance(
			`import type { Repo } from "@/domain/repo";\nexport class Impl implements Repo { find(): void {} staleMethod(): void {} }`,
			abs("src", "infrastructure", "Impl.ts"),
			fs,
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			className: "Impl",
			interfaceName: "Repo",
			methodName: "staleMethod",
			severity: "error",
		});
	});

	it("同文件接口实现应当通过", () => {
		const fs = makeFs({});
		const errors = checkInterfaceConformance(
			`interface Local { m(): void }\nexport class Impl implements Local { m(): void {} }`,
			abs("src", "infrastructure", "Impl.ts"),
			fs,
		);
		expect(errors).toHaveLength(0);
	});

	it("无法解析的接口应当跳过而不是误报", () => {
		const fs = makeFs({});
		const errors = checkInterfaceConformance(
			`export class Impl implements UnknownExternal { m(): void {} }`,
			abs("src", "infrastructure", "Impl.ts"),
			fs,
		);
		expect(errors).toHaveLength(0);
	});
});
