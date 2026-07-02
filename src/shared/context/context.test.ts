import { describe, expect, it, vi } from "vitest";
import {
	Background,
	WithCancel,
	WithDeadline,
	WithTimeout,
	WithValue,
} from "./context";
import { Canceled, DeadlineExceeded } from "./interface";

describe("Context", () => {
	describe("Background", () => {
		it("应为空 Context", () => {
			for (const ctx of [Background]) {
				const [date, ok] = ctx.deadline();
				expect(ok).toBe(false);
				expect(date.getTime()).toBe(0);
				expect(ctx.err()).toBeNull();
				expect(ctx.value("any")).toBeNull();
			}
		});

		it("done 应永远不会 resolve", async () => {
			const done = Background.done();
			const race = Promise.race([
				done,
				new Promise((resolve) => setTimeout(() => resolve("timeout"), 10)),
			]);
			expect(await race).toBe("timeout");
		});
	});

	describe("WithCancel", () => {
		it("当父级被取消时应取消子级", async () => {
			const [parent, cancelParent] = WithCancel(Background);
			const [child, _cancelChild] = WithCancel(parent);

			cancelParent();

			await child.done();
			expect(child.err()).toBe(Canceled);
			expect(parent.err()).toBe(Canceled);
		});

		it("当子级被取消时应仅取消该子级", async () => {
			const [parent, _cancelParent] = WithCancel(Background);
			const [child, cancelChild] = WithCancel(parent);

			cancelChild();

			await child.done();
			expect(child.err()).toBe(Canceled);

			// 父级应仍处于活跃状态
			const race = Promise.race([
				parent.done(),
				new Promise((resolve) => setTimeout(() => resolve("active"), 10)),
			]);
			expect(await race).toBe("active");
			expect(parent.err()).toBeNull();
		});

		it("应处理多次取消", () => {
			const [ctx, cancel] = WithCancel(Background);
			cancel();
			cancel(); // 不应报错或更改错误状态
			expect(ctx.err()).toBe(Canceled);
		});

		it("手动取消子级时应从父级中移除该子级", async () => {
			const [parent, _] = WithCancel(Background);
			// 访问内部 _children 进行验证
			const parentInternal = parent as any;
			const parentChildren = parentInternal._children as Set<any>;

			const [child, cancelChild] = WithCancel(parent);
			expect(parentChildren.has(child)).toBe(true);

			cancelChild();
			expect(parentChildren.has(child)).toBe(false);
		});
	});

	describe("WithValue", () => {
		it("应存储并检索值", () => {
			const key1 = Symbol("key1");
			const key2 = "key2";
			const ctx1 = WithValue(Background, key1, "val1");
			const ctx2 = WithValue(ctx1, key2, "val2");

			expect(ctx2.value(key2)).toBe("val2");
			expect(ctx2.value(key1)).toBe("val1");
			expect(ctx2.value("none")).toBeNull();
		});

		it("对于 nil key 应抛出异常", () => {
			expect(() => WithValue(Background, null, "val")).toThrow("nil key");
			expect(() => WithValue(Background, undefined, "val")).toThrow("nil key");
		});

		it("应将 deadline, done, 和 err 委托给父级", () => {
			const [parent, _cancel] = WithCancel(Background);
			const ctx = WithValue(parent, "key", "val");

			expect(ctx.done()).toBe(parent.done());
			expect(ctx.err()).toBe(parent.err());
			const [d1, ok1] = ctx.deadline();
			const [d2, ok2] = parent.deadline();
			expect(d1.getTime()).toBe(d2.getTime());
			expect(ok1).toBe(ok2);
		});
	});

	describe("WithDeadline & WithTimeout", () => {
		it("达到截止日期时应取消", async () => {
			const [ctx, _cancel] = WithTimeout(Background, 10);

			await ctx.done();
			expect(ctx.err()).toBe(DeadlineExceeded);
			const [date, ok] = ctx.deadline();
			void date; // 忽略未使用变量警告
			expect(ok).toBe(true);
		});

		it("在截止日期前应能手动取消", async () => {
			const [ctx, cancel] = WithTimeout(Background, 1000);
			cancel();

			await ctx.done();
			expect(ctx.err()).toBe(Canceled);
		});

		it("如果截止日期已过应立即取消", async () => {
			const past = new Date(Date.now() - 1000);
			const [ctx, _cancel] = WithDeadline(Background, past);

			expect(ctx.err()).toBe(DeadlineExceeded);
			await ctx.done();
		});

		it("应从父级继承更短的截止日期", () => {
			const [parent, _] = WithTimeout(Background, 50);
			const parentDeadline = parent.deadline()[0];

			const [child, _cancelChild] = WithDeadline(
				parent,
				new Date(Date.now() + 100),
			);
			// 子级应仍具有父级更短的截止日期（行为类似于 Go）
			// 在我们的实现中，我们返回委托截止日期的 WithCancel(parent)
			const [childDeadline, ok] = child.deadline();
			expect(ok).toBe(true);
			expect(childDeadline.getTime()).toBe(parentDeadline.getTime());
		});

		it("如果比父级更短，应具有自己的截止日期", () => {
			const [parent, _] = WithTimeout(Background, 500);
			const childDeadlineTime = Date.now() + 50;
			const [child, _cancelChild] = WithDeadline(
				parent,
				new Date(childDeadlineTime),
			);

			expect(child.deadline()[0].getTime()).toBe(childDeadlineTime);
		});

		it("应通过 Proxy 正确处理其他属性", async () => {
			const [ctx, cancel] = WithTimeout(Background, 1000);
			expect(ctx.value("key")).toBeNull();
			expect(ctx.done()).toBeDefined();
			expect(ctx.err()).toBeNull();
			cancel();
			expect(ctx.err()).toBe(Canceled);
		});

		it("如果 dur <= 0 应立即取消", async () => {
			const past = new Date(Date.now() - 1000);
			const [ctx, cancel] = WithDeadline(Background, past);
			cancel();
			expect(ctx.err()).toBe(DeadlineExceeded);
		});

		it("如果新截止日期更短，应使用新截止日期", () => {
			const [parent, _] = WithTimeout(Background, 100);
			const [child, _cancel] = WithDeadline(parent, new Date(Date.now() + 50));
			expect(child.deadline()[0].getTime()).toBeLessThan(
				parent.deadline()[0].getTime(),
			);
		});

		it("如果父级截止日期更短，应返回父级", () => {
			const [parent, _] = WithTimeout(Background, 50);
			const [child, _cancel] = WithDeadline(parent, new Date(Date.now() + 100));
			expect(child.deadline()[0].getTime()).toBe(
				parent.deadline()[0].getTime(),
			);
		});
	});

	describe("交集取消（用户场景）", () => {
		it("当嵌套 10s 和 3s 后，应在 3s 后取消", async () => {
			vi.useFakeTimers();

			const [ctxa, _1] = WithTimeout(Background, 10000);
			const [ctxb, _2] = WithTimeout(ctxa, 3000);

			let done = false;
			ctxb.done().then(() => {
				done = true;
			});

			vi.advanceTimersByTime(2999);
			expect(done).toBe(false);

			vi.advanceTimersByTime(2);
			// Promise 微任务需要运行
			await Promise.resolve();
			expect(done).toBe(true);
			expect(ctxb.err()).toBe(DeadlineExceeded);

			vi.useRealTimers();
		});

		it("当嵌套 3s 和 10s 后，应在 3s 后取消", async () => {
			vi.useFakeTimers();

			const [ctxa, _1] = WithTimeout(Background, 3000);
			const [ctxb, _2] = WithTimeout(ctxa, 10000);

			let done = false;
			ctxb.done().then(() => {
				done = true;
			});

			vi.advanceTimersByTime(2999);
			expect(done).toBe(false);

			vi.advanceTimersByTime(2);
			await Promise.resolve();
			expect(done).toBe(true);
			// ctxb 被取消是因为 ctxa 被取消了
			expect(ctxb.err()).toBe(DeadlineExceeded);

			vi.useRealTimers();
		});
	});

	describe("内部逻辑", () => {
		it("如果父级不是 cancelCtx，不应添加子节点", () => {
			const [ctx, _] = WithCancel(Background);
			expect((ctx as any)._parent).toBe(Background);
		});

		it("应处理已取消的父级", async () => {
			const [parent, cancelParent] = WithCancel(Background);
			cancelParent();
			const [child, _] = WithCancel(parent);
			await child.done();
			expect(child.err()).toBe(Canceled);
		});

		it("应处理深层嵌套的取消", async () => {
			let current = Background;
			for (let i = 0; i < 10; i++) {
				const [next, _] = WithCancel(current);
				current = next;
			}
			const [parent, cancelParent] = WithCancel(Background);
			const [child, _] = WithCancel(parent);
			cancelParent();
			await child.done();
		});

		it("如果父级 done 在没有错误的情况下 resolve，应跳过取消", async () => {
			const fakeParent = {
				deadline: () => [new Date(0), false],
				done: () => Promise.resolve(),
				err: () => null,
				value: () => null,
			} as any;
			const [ctx, _] = WithCancel(fakeParent);
			// 等待 propagateCancel 中的微任务
			await Promise.resolve();
			await Promise.resolve();
			expect(ctx.err()).toBeNull();
		});
	});
});
