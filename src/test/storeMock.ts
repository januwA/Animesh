/**
 * 创建 zustand store 的 mock，供组件测试复用：
 * - 支持无参调用返回完整 state（对应 UseBoundStore 的 `(): T` 重载）；
 * - 支持传入 selector 调用返回选中值（对应 `<U>(selector) => U` 重载）；
 * - 附带 `getState`，可手动读取完整 state。
 *
 * 真实 store 还包含 setState/subscribe 等 StoreApi 成员，组件测试通常只依赖
 * selector 调用形式，此处无需完整实现。返回值声明为 unknown，由调用方断言为
 * 对应的 store 类型（如 `as typeof import("...").useXxxStore`）。
 */
export function createStoreMock<T extends object>(state: T): unknown {
  return Object.assign(
    (selector?: (s: T) => unknown) => (selector ? selector(state) : state),
    { getState: () => state },
  );
}
