import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JsLivePlayerErrorMonitor } from "./JsLivePlayerErrorMonitor";

const mockLogger = {
  withCategory: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    withCategory: vi.fn(),
  }),
};

describe("JsLivePlayerErrorMonitor 直播错误监控组件", () => {
  it("应该渲染为空组件（返回 null）", () => {
    const { container } = render(
      <JsLivePlayerErrorMonitor logger={mockLogger} onRecover={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });
});
