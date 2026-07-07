import { compilePath } from "./PathUtils";

describe("PathUtils", () => {
	it("应该正确替换基础占位符", () => {
		const path = "/user/:id";
		const result = compilePath(path, { id: 123 });
		expect(result).toBe("/user/123");
	});

	it("应该支持多个占位符", () => {
		const path = "/org/:orgId/user/:userId";
		const result = compilePath(path, { orgId: "org1", userId: "user2" });
		expect(result).toBe("/org/org1/user/user2");
	});

	it("如果没有参数且路径无占位符，应直接返回路径", () => {
		const path = "/login";
		// 支持 compilePath(path) 这种不带参数的调用
		expect(compilePath(path)).toBe("/login");
	});

	it("同一个参数出现多次时应全部替换", () => {
		const path = "/duplicate/:id/:id";
		const result = compilePath(path, { id: "test" });
		expect(result).toBe("/duplicate/test/test");
	});

	it("特殊字符应被正确编码", () => {
		const path = "/search/:keyword";
		const result = compilePath(path, { keyword: "hello world" });
		expect(result).toBe("/search/hello%20world");
	});
});
