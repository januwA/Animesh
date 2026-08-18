import { describe, expect, it } from "vitest";
import { type NonEmptyString, NonEmptyStringSchema } from "./NonEmptyString";

describe("NonEmptyStringSchema", () => {
  it("应该解析非空字符串", () => {
    expect(NonEmptyStringSchema.safeParse("hello").success).toBe(true);
  });

  it("应该拒绝空字符串", () => {
    expect(NonEmptyStringSchema.safeParse("").success).toBe(false);
  });

  it("应该拒绝仅含空白的字符串", () => {
    expect(NonEmptyStringSchema.safeParse("   ").success).toBe(false);
    expect(NonEmptyStringSchema.safeParse("\t\n").success).toBe(false);
  });

  it("应该拒绝非字符串值", () => {
    expect(NonEmptyStringSchema.safeParse(123).success).toBe(false);
    expect(NonEmptyStringSchema.safeParse(null).success).toBe(false);
    expect(NonEmptyStringSchema.safeParse(undefined).success).toBe(false);
  });

  it("解析结果应为品牌类型", () => {
    const result = NonEmptyStringSchema.safeParse("hello");
    expect(result.success).toBe(true);
    if (!result.success) return;
    const value: NonEmptyString = result.data;
    expect(value).toBe("hello");
  });
});
