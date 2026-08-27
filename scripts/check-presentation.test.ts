import { describe, expect, it } from "vitest";
import {
	checkHooks,
	checkStyles,
	checkTauriImports,
	checkTestDi,
	isHookTestFile,
	isPageTestFile,
} from "./check-presentation";

const ROOT = process.cwd();
const PAGE_DIR = `${ROOT}/src/presentation/pages`;

describe("Tauri 导入规范检查", () => {
	it("当没有导入任何 @tauri-apps 的模块时，应该通过检查", () => {
		const code = `
			import { useState } from "react";
			import { useDI } from "@/di/DIContext";

			export default function MyComponent() {
				return null;
			}
		`;
		const results = checkTauriImports(code, "MyComponent.tsx");
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
		const results = checkTauriImports(code, "MyComponent.tsx");
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
		const results = checkTauriImports(code, "MyComponent.tsx");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("禁止导入 Tauri 相关的依赖包");
		expect(results[0].line).toBe(4);
	});

	it("当使用 export from 导出 @tauri-apps 的包时，应该报错", () => {
		const code = `
			export { openUrl } from "@tauri-apps/plugin-opener";
		`;
		const results = checkTauriImports(code, "MyComponent.tsx");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("禁止导入 Tauri 相关的依赖包");
		expect(results[0].line).toBe(2);
	});
});

describe("样式规范检查", () => {
	it("使用语义化类或不含冲突色彩的样式应该通过检查", () => {
		const code = `
			export default function MyComponent() {
				return (
					<div className="bg-card border-border text-foreground p-4">
						<span className="text-muted-foreground">Title</span>
					</div>
				);
			}
		`;
		const results = checkStyles(code, "MyComponent.tsx");
		expect(results).toHaveLength(0);
	});

	it("当使用硬编码的 border-white/5 时，应该报错", () => {
		const code = `
			export default function MyComponent() {
				return (
					<div className="border border-white/5 p-4">
						<span>Test</span>
					</div>
				);
			}
		`;
		const results = checkStyles(code, "MyComponent.tsx");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("检测到非法的硬编码样式类");
		expect(results[0].line).toBe(4);
	});

	it("当使用硬编码的 bg-black/10 时，应该报错", () => {
		const code = `
			export default function MyComponent() {
				return (
					<div className="bg-black/10">
						<span>Test</span>
					</div>
				);
			}
		`;
		const results = checkStyles(code, "MyComponent.tsx");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("bg-black/10");
	});

	it("当使用硬编码的 bg-cyan-950/20 时，应该报错", () => {
		const code = `
			export default function MyComponent() {
				return (
					<div className="bg-cyan-950/20">
						<span>Test</span>
					</div>
				);
			}
		`;
		const results = checkStyles(code, "MyComponent.tsx");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("bg-cyan-950/20");
	});

	it("当使用 style-ignore 绕过时，即使包含违规样式也应该通过检查", () => {
		const code = `
			export default function MyComponent() {
				return (
					<div className="bg-black border border-white/10"> {/* style-ignore */}
						<span>Test</span>
					</div>
				);
			}
		`;
		const results = checkStyles(code, "MyComponent.tsx");
		expect(results).toHaveLength(0);
	});

	it("当 style-ignore 在违规样式的下一行时（biome 格式化场景），也应该通过检查", () => {
		const code = `
			export default function MyComponent() {
				return (
					<Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
						{/* style-ignore */}
						已完成
					</Badge>
				);
			}
		`;
		const results = checkStyles(code, "MyComponent.tsx");
		expect(results).toHaveLength(0);
	});

	it("当 style-ignore 在违规样式的上一行时，也应该通过检查", () => {
		const code = `
			export default function MyComponent() {
				return (
					<div>
						{/* style-ignore */}
						<div className="bg-black border-white/5 p-4">content</div>
					</div>
				);
			}
		`;
		const results = checkStyles(code, "MyComponent.tsx");
		expect(results).toHaveLength(0);
	});
});

describe("hook 大小与耦合检查", () => {
	it("返回成员不超过 20 的 hook 应当通过", () => {
		const code = `
export function usePlayerData() {
  const [a, setA] = useState(0);
  return { a, setA, b, c, d, e, f };
}
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/pages/Player/usePlayerData.ts`,
		);
		expect(errors).toHaveLength(0);
	});

	it("返回成员超过 20 应当报错", () => {
		const code = `
export function useSettingsPage() {
  return { a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15,a16,a17,a18,a19,a20,a21 };
}
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/pages/Settings/useSettingsPage.ts`,
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			severity: "error",
			message: expect.stringContaining("21"),
		});
	});

	it("一层嵌套对象字面量（controller 模式）超限应当报错", () => {
		const code = `
export function useBoard() {
  return { a: 1, board: { b1,b2,b3,b4,b5,b6,b7,b8,b9,b10,b11,b12,b13,b14,b15,b16,b17,b18,b19,b20,b21 } };
}
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/pages/Settings/useSettingsPage.ts`,
		);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("board");
	});

	it("返回标识符子对象不应计数，应视为内聚子对象通过", () => {
		const code = `
export function useSubjectDetail() {
  const info = useSubjectInfo();
  const episodes = useSubjectEpisodes();
  return { info, episodes };
}
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/pages/SubjectDetail/useSubjectDetail.ts`,
		);
		expect(errors).toHaveLength(0);
	});

	it("deps 接口属性超过 8 应当报错", () => {
		const code = `
export interface UseSubjectDetailDeps {
  a: Pick<AUseCase, "execute">;
  b: Pick<BUseCase, "execute">;
  c: Pick<CUseCase, "execute">;
  d: Pick<DUseCase, "execute">;
  e: Pick<EUseCase, "execute">;
  f: Pick<FUseCase, "execute">;
  g: Pick<GUseCase, "execute">;
  h: Pick<HUseCase, "execute">;
  i: Pick<IUseCase, "execute">;
}
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/pages/SubjectDetail/useSubjectDetail.ts`,
		);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("UseSubjectDetailDeps");
		expect(errors[0].message).toContain("9");
	});

	it("params 接口属性超过 5 应当报错", () => {
		const code = `
export interface UsePlayerSubtitleParams {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/pages/Player/usePlayerSubtitle.ts`,
		);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("UsePlayerSubtitleParams");
	});

	it("useEffect 数量超过 3 应当报错", () => {
		const code = `
export function useOverload() {
  useEffect(() => {}, []);
  useEffect(() => {}, []);
  useEffect(() => {}, []);
  useEffect(() => {}, []);
  return { a: 1 };
}
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/pages/Player/usePlayerSubtitle.ts`,
		);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("4 次 useEffect");
	});

	it("useQuery 与 useMutation 总数超过 5 应当报错", () => {
		const code = `
export function useManyQueries() {
  useQuery(() => Promise.resolve(1), []);
  useQuery(() => Promise.resolve(1), []);
  useQuery(() => Promise.resolve(1), []);
  useMutation(() => Promise.resolve(1));
  useMutation(() => Promise.resolve(1));
  useMutation(() => Promise.resolve(1));
  return { a: 1 };
}
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/pages/SubjectDetail/useSubjectDetail.ts`,
		);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("6 次");
	});

	it("非 use 前缀函数与未导出 hook 不应检查", () => {
		const code = `
function useInternal() {
  return { a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w };
}
export function helper() {
  return { a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w };
}
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/pages/Settings/useSettingsPage.ts`,
		);
		expect(errors).toHaveLength(0);
	});

	it("zustand create 形式的导出不应被当作 hook", () => {
		const code = `
export const useSearchStore = create<State>()((set) => ({ a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w }));
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/store/searchStore.ts`,
		);
		expect(errors).toHaveLength(0);
	});

	it("箭头函数隐式返回对象字面量应被检查", () => {
		const code = `
export const useTorrentSearchPage = (keyword) => ({
  a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15,a16,a17,a18,a19,a20,a21,
});
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/pages/TorrentSearch/useTorrentSearchPage.ts`,
		);
		expect(errors).toHaveLength(1);
	});

	it("无返回语句的 hook 应当通过", () => {
		const code = `
export function useGlobalEffects(deps) {
  useEffect(() => {}, []);
}
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/hooks/useGlobalEffects.ts`,
		);
		expect(errors).toHaveLength(0);
	});

	it("export { useX } 说明符形式也应被检查", () => {
		const code = `
function useHiddenWide() {
  return { a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15,a16,a17,a18,a19,a20,a21 };
}
export { useHiddenWide };
`;
		const errors = checkHooks(
			code,
			`${ROOT}/src/presentation/pages/Settings/useSettingsPage.ts`,
		);
		expect(errors).toHaveLength(1);
	});
});

describe("测试 DI 注入规范", () => {
	it("useXxx.test.tsx 属于 hook 级单测", () => {
		expect(isHookTestFile(`${PAGE_DIR}/Settings/useSettingsPage.test.tsx`)).toBe(
			true,
		);
	});

	it("index.test.tsx 属于页面级集成测试", () => {
		expect(isPageTestFile(`${PAGE_DIR}/Player/index.test.tsx`)).toBe(true);
	});

	it("单文件页面测试不属于页面级集成测试", () => {
		expect(isPageTestFile(`${PAGE_DIR}/Calendar.test.tsx`)).toBe(false);
	});

	it("普通组件测试文件两种分类均不匹配", () => {
		expect(
			isHookTestFile(`${ROOT}/src/presentation/components/Button.test.tsx`),
		).toBe(false);
		expect(
			isPageTestFile(`${ROOT}/src/presentation/components/Button.test.tsx`),
		).toBe(false);
	});

	const pageTestPath = `${PAGE_DIR}/Player/index.test.tsx`;
	const options = { siblingUsesUseDI: true };

	it("页面级测试未 import DIProvider 应当报错", () => {
		const code = `
const container = {} as unknown as DIContainer;
render(<PlayerView />);
`;
		const errors = checkTestDi(code, pageTestPath, options);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("DIProvider");
	});
});
