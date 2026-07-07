import {
	Canceled,
	type CancelFunc,
	type Context,
	type ContextKey,
	DeadlineExceeded,
} from "./interface";

/**
 * emptyCtx 实现了 Context 接口，不包含任何值和截止日期。
 * 它永远不会被取消。
 */
class emptyCtx implements Context {
	deadline(): [Date, boolean] {
		return [new Date(0), false];
	}
	done(): Promise<void> {
		return new Promise(() => {});
	}
	err(): Error | null {
		return null;
	}
	value<T = unknown>(_key: ContextKey): T | null {
		return null;
	}
}

/**
 * Background 返回一个非空的、空的 Context。它永远不会被取消，没有值，也没有截止日期。
 */
export const Background: Context = new emptyCtx();

/**
 * cancelCtx 可以被取消。
 */
class cancelCtx implements Context {
	protected _done: Promise<void>;
	protected _resolveDone!: () => void;
	protected _err: Error | null = null;
	protected _children: Set<cancelCtx> = new Set();
	protected _parent: Context;

	constructor(parent: Context) {
		this._parent = parent;
		this._done = new Promise((resolve) => {
			this._resolveDone = resolve;
		});

		// 如果 parent 也是 cancelCtx，注册此子节点
		if (parent instanceof cancelCtx) {
			parent.addChild(this);
		}

		this.propagateCancel(parent);
	}

	deadline(): [Date, boolean] {
		return this._parent.deadline();
	}

	done(): Promise<void> {
		return this._done;
	}

	err(): Error | null {
		return this._err;
	}

	value<T = unknown>(key: ContextKey): T | null {
		return this._parent.value<T>(key);
	}

	protected propagateCancel(parent: Context) {
		parent.done().then(() => {
			const err = parent.err();
			if (err) {
				this.cancel(false, err);
			}
		});
	}

	cancel(removeFromParent: boolean, err: Error) {
		if (this._err !== null) {
			return;
		}
		this._err = err;
		this._resolveDone();

		for (const child of this._children) {
			child.cancel(false, err);
		}
		this._children.clear();

		if (removeFromParent && this._parent instanceof cancelCtx) {
			this._parent.removeChild(this);
		}
	}

	addChild(child: cancelCtx) {
		this._children.add(child);
	}

	removeChild(child: cancelCtx) {
		this._children.delete(child);
	}
}

/**
 * valueCtx 携带一个键值对。
 */
class valueCtx implements Context {
	constructor(
		protected parent: Context,
		protected key: ContextKey,
		protected val: unknown,
	) {}

	deadline(): [Date, boolean] {
		return this.parent.deadline();
	}

	done(): Promise<void> {
		return this.parent.done();
	}

	err(): Error | null {
		return this.parent.err();
	}

	value<T = unknown>(key: ContextKey): T | null {
		if (this.key === key) {
			return this.val as T;
		}
		return this.parent.value<T>(key);
	}
}

/**
 * WithCancel 返回父级 Context 的副本，并带有一个新的 Done Promise。
 */
export function WithCancel(parent: Context): [Context, CancelFunc] {
	const c = new cancelCtx(parent);
	return [c, () => c.cancel(true, Canceled)];
}

/**
 * WithValue 返回父级 Context 的副本，并带有新的键值对。
 */
export function WithValue(
	parent: Context,
	key: ContextKey,
	val: unknown,
): Context {
	if (key === null || key === undefined) {
		throw new Error("nil key");
	}
	return new valueCtx(parent, key, val);
}

/**
 * WithDeadline 返回父级 Context 的副本，并带有截止日期。
 */
export function WithDeadline(
	parent: Context,
	deadline: Date,
): [Context, CancelFunc] {
	const [pDeadline, ok] = parent.deadline();
	if (ok && pDeadline < deadline) {
		return WithCancel(parent);
	}

	const c = new cancelCtx(parent);
	const dur = deadline.getTime() - Date.now();

	if (dur <= 0) {
		c.cancel(true, DeadlineExceeded);
		return [c, () => {}];
	}

	const timer = setTimeout(() => {
		c.cancel(true, DeadlineExceeded);
	}, dur);

	const cancel = () => {
		clearTimeout(timer);
		c.cancel(true, Canceled);
	};

	// 创建一个具有新截止日期的 timerCtx
	const timerCtxProxy = new Proxy(c, {
		get(target, prop, receiver) {
			if (prop === "deadline") {
				return () => [deadline, true];
			}
			return Reflect.get(target, prop, receiver);
		},
	});

	return [timerCtxProxy as unknown as Context, cancel];
}

/**
 * WithTimeout 返回 WithDeadline(parent, new Date(Date.now() + timeoutMs))。
 */
export function WithTimeout(
	parent: Context,
	timeoutMs: number,
): [Context, CancelFunc] {
	return WithDeadline(parent, new Date(Date.now() + timeoutMs));
}
