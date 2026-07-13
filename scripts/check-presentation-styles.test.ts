import { describe, expect, it } from "vitest";
import { checkCode } from "./check-presentation-styles";

describe("表现层样式规范检查", () => {
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
		const results = checkCode(code, "MyComponent.tsx");
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
		const results = checkCode(code, "MyComponent.tsx");
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
		const results = checkCode(code, "MyComponent.tsx");
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
		const results = checkCode(code, "MyComponent.tsx");
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
		const results = checkCode(code, "MyComponent.tsx");
		expect(results).toHaveLength(0);
	});
});
