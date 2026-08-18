import { z } from "zod";

export const NonEmptyStringSchema = z
  .string()
  .trim()
  .min(1, "不能为空字符串")
  .brand("NonEmptyString");

export type NonEmptyString = z.infer<typeof NonEmptyStringSchema>;
