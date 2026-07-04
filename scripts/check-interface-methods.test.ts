import { describe, expect, it } from "vitest";
import { checkCode } from "./check-interface-methods";

describe("接口设计可空方法检查", () => {
	it("当接口中全是正常方法（非可选）时，应当通过检查", () => {
		const code = `
			export interface BangumiRepository {
				getCalendar(ctx: Context): Promise<BangumiCalendarDay[]>;
				getSubject(ctx: Context, subjectId: string): Promise<BangumiSubject>;
			}
		`;
		const results = checkCode(code, "BangumiRepository.ts");
		expect(results).toHaveLength(0);
	});

	it("当接口中包含可选方法时，应当报错", () => {
		const code = `
			export interface BangumiRepository {
				getCalendar(ctx: Context): Promise<BangumiCalendarDay[]>;
				getSubject?(ctx: Context, subjectId: string): Promise<BangumiSubject>;
			}
		`;
		const results = checkCode(code, "BangumiRepository.ts");
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			line: 4,
			severity: "error",
			message: "接口设计中不能出现可为空的方法 getSubject。",
		});
	});

	it("当接口中包含可选的函数类型属性时，应当报错", () => {
		const code = `
			export interface SettingsRepository {
				getSettings: () => Promise<Settings>;
				selectDirectory?: () => Promise<string | null>;
			}
		`;
		const results = checkCode(code, "SettingsRepository.ts");
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			line: 4,
			severity: "error",
			message: "接口设计中不能出现可为空的方法 selectDirectory。",
		});
	});

	it("当接口中包含非函数类型的可选属性时，应当通过检查", () => {
		const code = `
			export interface UserDto {
				id: string;
				name?: string;
				age?: number;
			}
		`;
		const results = checkCode(code, "UserDto.ts");
		expect(results).toHaveLength(0);
	});

	it("当类型别名 TypeAlias 中包含可选方法或可选函数属性时，应当报错", () => {
		const code = `
			type MyRepository = {
				fetchData?(id: string): Promise<any>;
				onSuccess?: () => void;
			};
		`;
		const results = checkCode(code, "MyRepository.ts");
		expect(results).toHaveLength(2);
		expect(results[0].message).toContain("fetchData");
		expect(results[1].message).toContain("onSuccess");
	});

	it("当接口方法的参数是可选的时，应当通过检查（只检查方法本身是否可选）", () => {
		const code = `
			export interface Logger {
				info(message: string, context?: any): void;
			}
		`;
		const results = checkCode(code, "Logger.ts");
		expect(results).toHaveLength(0);
	});

	it("当类 Class 中包含可选方法时，应当报错", () => {
		const code = `
			export class GetBangumiCalendarUseCase {
				constructor(private bangumiRepository: BangumiRepository) {}

				execute?(ctx: Context): Promise<BangumiCalendarDay[]> {
					return this.bangumiRepository.getCalendar(ctx);
				}
			}
		`;
		const results = checkCode(code, "GetBangumiCalendarUseCase.ts");
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			line: 5,
			severity: "error",
			message: "接口设计中不能出现可为空的方法 execute。",
		});
	});

	it("当类 Class 中包含可选的函数属性时，应当报错", () => {
		const code = `
			export class GetBangumiCalendarUseCase {
				execute?: (ctx: Context) => Promise<BangumiCalendarDay[]> = (ctx) => {
					return this.bangumiRepository.getCalendar(ctx);
				};
			}
		`;
		const results = checkCode(code, "GetBangumiCalendarUseCase.ts");
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			line: 3,
			severity: "error",
			message: "接口设计中不能出现可为空的方法 execute。",
		});
	});
});
