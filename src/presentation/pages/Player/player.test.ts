import { describe, expect, it } from "vitest";
import { JsPlayer } from "./player";

describe("player JsPlayer 播放器实例", () => {
  it("应该通过 @videojs/react 创建播放器实例", () => {
    expect(JsPlayer).toBeDefined();
  });
});
