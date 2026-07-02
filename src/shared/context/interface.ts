export type ContextKey = any;

/**
 * Canceled 是当 Context 被取消时，Context.err 返回的错误内容。
 */
export const Canceled = new Error("context canceled");

/**
 * DeadlineExceeded 是当 Context 的截止日期过期时，Context.err 返回的错误内容。
 */
export const DeadlineExceeded = new Error("context deadline exceeded");

/**
 * Context 跨 API 边界传递截止日期、取消信号和其他值。
 */
export interface Context {
	/**
	 * deadline 返回代表此 Context 完成的工作应被取消的时间。
	 * 未设置截止日期时，deadline 返回 [Date(0), false]。
	 * 连续调用 deadline 返回相同的结果。
	 */
	deadline(): [Date, boolean];

	/**
	 * done 返回一个 Promise，当代表此 Context 完成的工作应被取消时，该 Promise 将被 resolve。
	 * 如果此 Context 永远无法被取消，done 可能会返回一个永远不会 resolve 的 Promise。
	 * 连续调用 done 返回相同的值。
	 */
	done(): Promise<void>;

	/**
	 * 如果 done 尚未 resolve，err 返回 null。
	 * 如果 done 已 resolve，err 返回一个非空错误说明原因：
	 * 如果 Context 被取消，则返回 Canceled；
	 * 如果 Context 的截止日期过期，则返回 DeadlineExceeded。
	 * 在 err 返回非空错误后，连续调用 err 返回同一个错误。
	 */
	err(): Error | null;

	/**
	 * value 返回此 Context 中与 key 关联的值，如果没有与 key 关联的值，则返回 null。
	 * 使用相同的 key 连续调用 value 返回相同的结果。
	 */
	value(key: ContextKey): any;
}

/**
 * CancelFunc 指示操作放弃其工作。
 */
export type CancelFunc = () => void;
