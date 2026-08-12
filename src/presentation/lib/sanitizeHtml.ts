import DOMPurify from "dompurify";

// 对来自外部数据源的 HTML 进行净化，防止 XSS
export function sanitizeHtml(rawHtml: string): string {
  return DOMPurify.sanitize(rawHtml);
}
