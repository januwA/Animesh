// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("应保留安全的 HTML 结构", () => {
    const out = sanitizeHtml("<p>1080P <b>简体内封字幕</b></p>");
    expect(out).toContain("<p>");
    expect(out).toContain("<b>");
    expect(out).toContain("1080P");
    expect(out).toContain("简体内封字幕");
  });

  it("应剥离 script 及其内容", () => {
    const out = sanitizeHtml(
      "<p>安全描述</p><script>window.__xss_injected = true</script>",
    );
    expect(out).not.toContain("script");
    expect(out).not.toContain("__xss_injected");
    expect(out).toContain("安全描述");
  });

  it("应剥离内联事件属性", () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)" />');
    expect(out).not.toContain("onerror");
  });

  it("应剥离 iframe 等嵌入标签与 javascript 协议链接", () => {
    const out = sanitizeHtml(
      '<iframe src="https://evil.example.com"></iframe><a href="javascript:alert(1)">bad</a><p>ok</p>',
    );
    expect(out).not.toContain("iframe");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("ok");
  });
});
