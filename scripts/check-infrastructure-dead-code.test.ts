import { describe, expect, it } from "vitest";
import {
	checkDeadCode,
	collectReferencedIdentifiers,
	parseInfrastructureClasses,
} from "./check-infrastructure-dead-code";

describe("基础设施导出类解析", () => {
	it("应当只收集 export class（忽略未导出的内部类）", () => {
		const classes = parseInfrastructureClasses(
			`
				export class HttpRepo {
					find(): void {}
				}
				class InternalHelper {}
			`,
			"HttpRepo.ts",
		);
		expect(classes).toHaveLength(1);
		expect(classes[0]).toMatchObject({
			name: "HttpRepo",
			filepath: "HttpRepo.ts",
		});
	});

	it("应当支持 export default class", () => {
		const classes = parseInfrastructureClasses(
			`export default class Client { run(): void {} }`,
			"Client.ts",
		);
		expect(classes).toHaveLength(1);
		expect(classes[0].name).toBe("Client");
	});

	it("应当忽略接口与函数", () => {
		const classes = parseInfrastructureClasses(
			`
				export interface CacheStore { get(key: string): Promise<unknown> }
				export function helper(): void {}
				export class IndexedDbCacheStore { async get(): Promise<null> { return null; } }
			`,
			"IndexedDbCacheStore.ts",
		);
		expect(classes).toHaveLength(1);
		expect(classes[0].name).toBe("IndexedDbCacheStore");
	});
});

describe("引用标识符收集", () => {
	it("应当收集引用，排除成员属性名与对象键名", () => {
		const refs = collectReferencedIdentifiers(
			`
				import { HttpClient } from "@/infrastructure/http/HttpClient";
				const client = new HttpClient();
				const obj = { HttpClient: 1 };
				client.HttpClient;
				function getRepo(client: HttpClient): void {}
				getRepo(client);
			`,
			"consumer.ts",
		);
		expect(refs.has("HttpClient")).toBe(true);
		expect(refs.has("getRepo")).toBe(true);
		expect(refs.has("client")).toBe(true);
	});

	it("仅作为成员属性或对象键出现的名字不应被记为引用", () => {
		const refs = collectReferencedIdentifiers(
			`
				interface Shape { dead: string }
				const map = { dead: 1 };
				const s: Shape = { dead: "x" };
				console.log(map.dead, s.dead, marker);
			`,
			"consumer.ts",
		);
		expect(refs.has("dead")).toBe(false);
		expect(refs.has("marker")).toBe(true);
	});
});

describe("基础设施死代码检查", () => {
	it("被其他文件引用的类应当通过", () => {
		const classes = parseInfrastructureClasses(
			`export class HttpRepo { find(): void {} }`,
			"src/infrastructure/HttpRepo.ts",
		);
		const referencedByFile = new Map<string, Set<string>>([
			["src/di/repositories.ts", new Set(["HttpRepo"])],
		]);
		const errors = checkDeadCode(classes, referencedByFile);
		expect(errors).toHaveLength(0);
	});

	it("仅被自身文件引用的类应当报死代码", () => {
		const classes = parseInfrastructureClasses(
			`export class Orphan { find(): void {} }`,
			"src/infrastructure/Orphan.ts",
		);
		const referencedByFile = new Map<string, Set<string>>([
			["src/infrastructure/Orphan.ts", new Set(["Orphan"])],
		]);
		const errors = checkDeadCode(classes, referencedByFile);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			name: "Orphan",
			severity: "error",
			message: expect.stringContaining("Orphan"),
		});
	});

	it("在任意生产文件中被引用即可通过", () => {
		const classes = parseInfrastructureClasses(
			`export class HttpClient { run(): void {} }`,
			"src/infrastructure/http/HttpClient.ts",
		);
		const referencedByFile = new Map<string, Set<string>>([
			["src/infrastructure/ai/FetchAiClient.ts", new Set(["HttpClient"])],
		]);
		const errors = checkDeadCode(classes, referencedByFile);
		expect(errors).toHaveLength(0);
	});
});
