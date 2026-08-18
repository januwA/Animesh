import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { PlayerTitle } from "./PlayerTitle";

describe("PlayerTitle 视频标题组件", () => {
  const fileName = NonEmptyStringSchema.parse("video_name.mp4");
  const title = NonEmptyStringSchema.parse("测试视频");

  it("应该渲染文件名与种子标题", () => {
    render(<PlayerTitle fileName={fileName} title={title} />);

    expect(screen.getByText("video_name.mp4")).toBeInTheDocument();
    expect(screen.getByText("来自种子: 测试视频")).toBeInTheDocument();
  });
});
