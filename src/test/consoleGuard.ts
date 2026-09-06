// ── 将 console 警告/错误视为测试失败 ──────────────────────────────────────────
// 共享模块：被 setup.ts（dom 项目）与 setup.node.ts（node 项目）共同使用。

import { afterEach } from "vitest";

// 不需要引发测试失败的模式（可忽略的第三方库警告）
const IGNORED_PATTERNS: (RegExp | string)[] = [
  // react-router 在测试环境（无 document.startViewTransition）下对 viewTransition 导航的提示，导航本身正常进行
  "You provided the `viewTransition` option to a router update",
];

function shouldIgnore(message: string): boolean {
  return IGNORED_PATTERNS.some((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(message);
    return message.includes(pattern);
  });
}

const activeTestErrors = new Set<string>();

/** 在 console.error/warn 上安装守卫，并在每个测试结束时对捕获到的错误断言失败。 */
export function installConsoleGuard(): void {
  console.error = (...args) => {
    // originalConsoleError(...args);
    const message = args
      .map((arg) => (arg instanceof Error ? arg.stack : String(arg)))
      .join(" ");
    if (!shouldIgnore(message)) {
      activeTestErrors.add(`[console.error] ${message}`);
    }
  };

  console.warn = (...args) => {
    // originalConsoleWarn(...args);
    const message = args
      .map((arg) => (arg instanceof Error ? arg.stack : String(arg)))
      .join(" ");
    if (!shouldIgnore(message)) {
      activeTestErrors.add(`[console.warn] ${message}`);
    }
  };

  afterEach(() => {
    if (activeTestErrors.size > 0) {
      const messages = Array.from(activeTestErrors.values()).join("\n\n");
      activeTestErrors.clear();
      throw new Error(`测试中检测到 console 错误/警告：\n\n${messages}`);
    }
  });
}
