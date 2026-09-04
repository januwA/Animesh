import type { Context, ContextKey } from "ajanuw-context";

export const TRACE_ID: ContextKey = "traceId";

export function isContextLike(obj: unknown): obj is Context {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Context).deadline === "function" &&
    typeof (obj as Context).done === "function" &&
    typeof (obj as Context).err === "function" &&
    typeof (obj as Context).value === "function"
  );
}
